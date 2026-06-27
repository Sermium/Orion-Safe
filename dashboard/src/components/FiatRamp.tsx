import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  getAnchors,
  computePlatformFee,
  startDeposit,
  startWithdraw,
  finalizeWithdraw,
  pollRampStatus,
  PLATFORM_FEE_BPS,
  type AnchorInfo,
  type FeeBreakdown,
} from '../lib/fiat';
import { deriveSACAddress } from '../lib/stellar';

type Mode = 'deposit' | 'withdraw';

interface FiatRampProps {
  /** Connected signer's public key (from your wallet context/service). */
  userPublicKey: string;
  /** The vault to fund / withdraw from. */
  vaultAddress: string;
  /** Optional callback after a withdrawal creates its proposals. */
  onWithdrawProposed?: (ids: { withdrawProposalId: number; feeProposalId: number }) => void;
}

const USDC_CODE = 'USDC';

export const FiatRamp: React.FC<FiatRampProps> = ({
  userPublicKey,
  vaultAddress,
  onWithdrawProposed,
}) => {
  const anchors = useMemo(() => getAnchors(), []);
  const [mode, setMode] = useState<Mode>('deposit');
  const [anchorId, setAnchorId] = useState<string>(anchors[0]?.id ?? '');
  const [amount, setAmount] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const numericAmount = parseFloat(amount) || 0;
  const fee: FeeBreakdown = useMemo(
    () => computePlatformFee(numericAmount),
    [numericAmount]
  );

  const selectedAnchor: AnchorInfo | undefined = anchors.find((a) => a.id === anchorId);

  // MoneyGram limits (USDC). Adjust if you support other anchors with other limits.
  const limits =
    mode === 'deposit' ? { min: 5, max: 950 } : { min: 5, max: 2500 };
  const outOfRange =
    numericAmount > 0 && (numericAmount < limits.min || numericAmount > limits.max);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const openPopup = (url: string) => {
    popupRef.current = window.open(
      url,
      'orion-fiat-ramp',
      'width=480,height=720,menubar=no,toolbar=no'
    );
  };

  const beginPolling = useCallback(
    (transactionId: string, onComplete?: (tx: any) => void) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const tx: any = await pollRampStatus(anchorId, userPublicKey, transactionId);
          setStatus(`Anchor status: ${tx.status}`);
          const terminal = ['completed', 'refunded', 'error', 'expired'];
          if (tx.status === 'pending_user_transfer_start') {
            onComplete?.(tx);
            if (pollRef.current) clearInterval(pollRef.current);
          } else if (terminal.includes(tx.status)) {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch (e: any) {
          // keep polling through transient errors
          console.warn('poll error', e?.message);
        }
      }, 4000);
    },
    [anchorId, userPublicKey]
  );

  const handleDeposit = useCallback(async () => {
    setError('');
    setBusy(true);
    setStatus('Authenticating with anchor…');
    try {
      const session = await startDeposit({
        anchorId,
        userPublicKey,
        destination: vaultAddress, // USDC lands directly in the treasury
        amount: numericAmount || undefined,
      });
      setStatus('Opening cash-in window…');
      openPopup(session.url);
      beginPolling(session.transactionId);
    } catch (e: any) {
      setError(e?.message || 'Deposit failed to start');
    } finally {
      setBusy(false);
    }
  }, [anchorId, userPublicKey, vaultAddress, numericAmount, beginPolling]);

  const handleWithdraw = useCallback(async () => {
    setError('');
    setBusy(true);
    setStatus('Authenticating with anchor…');
    try {
      const usdcContract = deriveSACAddress(
        USDC_CODE,
        // issuer is resolved inside fiat.ts/SAC; if your deriveSACAddress needs the
        // issuer explicitly, pass the USDC issuer for the active network here.
        ''
      );

      const res = await startWithdraw({
        anchorId,
        userPublicKey,
        vaultAddress,
        vaultUsdcContract: usdcContract,
        amount: numericAmount,
      });

      setStatus('Opening KYC / cash-out window…');
      openPopup(res.ramp.url);

      // Wait for the anchor to give us its receiving account + memo,
      // then create the multisig proposals (net withdrawal + 0.3% fee).
      beginPolling(res.ramp.transactionId, async (tx) => {
        setStatus('Creating multisig proposals (withdrawal + 0.3% fee)…');
        const anchorAccount = tx.withdraw_anchor_account || tx.to;
        const ids = await finalizeWithdraw({
          userPublicKey,
          vaultAddress,
          vaultUsdcContract: usdcContract,
          anchorAccount,
          fee: res.fee,
        });
        setStatus(
          `Proposals created. Withdrawal #${ids.withdrawProposalId}, ` +
            `fee #${ids.feeProposalId}. Collect approvals to execute.`
        );
        onWithdrawProposed?.(ids);
      });
    } catch (e: any) {
      setError(e?.message || 'Withdrawal failed to start');
    } finally {
      setBusy(false);
    }
  }, [anchorId, userPublicKey, vaultAddress, numericAmount, beginPolling, onWithdrawProposed]);

  const canSubmit =
    !!userPublicKey &&
    !!anchorId &&
    numericAmount >= limits.min &&
    numericAmount <= limits.max &&
    !busy;

  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-900/60 p-6 max-w-md">
      <h3 className="text-lg font-semibold text-white mb-1">Fiat Cash In / Out</h3>
      <p className="text-sm text-gray-400 mb-4">
        Deposit or withdraw USDC via cash through MoneyGram and other Stellar anchors.
      </p>

      {/* Mode toggle */}
      <div className="flex rounded-lg bg-gray-800 p-1 mb-4">
        {(['deposit', 'withdraw'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 text-sm rounded-md capitalize ${
              mode === m ? 'bg-indigo-600 text-white' : 'text-gray-400'
            }`}
          >
            {m === 'deposit' ? 'Cash → Vault' : 'Vault → Cash'}
          </button>
        ))}
      </div>

      {/* Anchor picker */}
      <label className="block text-xs text-gray-400 mb-1">Provider</label>
      <select
        value={anchorId}
        onChange={(e) => setAnchorId(e.target.value)}
        className="w-full mb-4 rounded-lg bg-gray-800 text-white p-2 text-sm"
      >
        {anchors.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} — {a.description}
          </option>
        ))}
      </select>

      {/* Amount */}
      <label className="block text-xs text-gray-400 mb-1">Amount (USDC)</label>
      <input
        type="number"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={`${limits.min} – ${limits.max}`}
        className="w-full rounded-lg bg-gray-800 text-white p-2 text-sm mb-1"
      />
      <p className="text-xs text-gray-500 mb-3">
        Limits: {limits.min}–{limits.max} USDC per transaction
      </p>

      {/* Fee breakdown */}
      {numericAmount > 0 && (
        <div className="rounded-lg bg-gray-800/60 p-3 text-sm space-y-1 mb-4">
          <Row label="Amount" value={`${fee.grossAmount.toFixed(2)} USDC`} />
          <Row
            label={`Platform fee (${(PLATFORM_FEE_BPS / 100).toFixed(2)}%)`}
            value={`-${fee.platformFee.toFixed(4)} USDC`}
          />
          <div className="border-t border-gray-700 my-1" />
          <Row
            label={mode === 'deposit' ? 'You receive in vault' : 'Sent to anchor'}
            value={`${fee.netAmount.toFixed(4)} USDC`}
            strong
          />
          <p className="text-[11px] text-gray-500 pt-1">
            Anchor and network fees are charged separately by{' '}
            {selectedAnchor?.name ?? 'the provider'}.
          </p>
        </div>
      )}

      {outOfRange && (
        <p className="text-xs text-amber-400 mb-3">
          Amount must be between {limits.min} and {limits.max} USDC.
        </p>
      )}

      <button
        disabled={!canSubmit}
        onClick={mode === 'deposit' ? handleDeposit : handleWithdraw}
        className={`w-full py-2.5 rounded-lg font-medium text-sm ${
          canSubmit
            ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        {busy
          ? 'Working…'
          : mode === 'deposit'
          ? 'Start cash deposit'
          : 'Start cash withdrawal'}
      </button>

      {status && <p className="text-xs text-gray-300 mt-3">{status}</p>}
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

      {mode === 'withdraw' && (
        <p className="text-[11px] text-gray-500 mt-3">
          Withdrawals create two multisig proposals (the transfer and the 0.3% fee).
          Your signers must approve them before funds leave the vault.
        </p>
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; strong?: boolean }> = ({
  label,
  value,
  strong,
}) => (
  <div className="flex justify-between">
    <span className="text-gray-400">{label}</span>
    <span className={strong ? 'text-white font-semibold' : 'text-gray-200'}>
      {value}
    </span>
  </div>
);
