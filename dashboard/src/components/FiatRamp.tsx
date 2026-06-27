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
import { Transak, type TransakConfig } from '@transak/ui-js-sdk';

type Mode = 'deposit' | 'withdraw';
type Provider = 'transak' | 'moneygram' | 'stripe';

interface FiatRampProps {
  /** Connected signer's public key (from your wallet context/service). */
  userPublicKey: string;
  /** The vault to fund / withdraw from. */
  vaultAddress: string;
  /** Optional callback after a withdrawal creates its proposals. */
  onWithdrawProposed?: (ids: { withdrawProposalId: number; feeProposalId: number }) => void;
}

const USDC_CODE = 'USDC';
const TRANSAK_API_KEY = process.env.REACT_APP_TRANSAK_API_KEY || '';
// Production host. Use https://global-stg.transak.com for staging.
const TRANSAK_BASE_URL = 'https://global.transak.com';

// Provider metadata for the selector cards.
const PROVIDERS: {
  id: Provider;
  name: string;
  blurb: string;
  badge?: string;
  enabled: boolean;
  supportsWithdraw: boolean;
}[] = [
  {
    id: 'transak',
    name: 'Transak',
    blurb: 'Card & bank → USDC, delivered straight to the vault.',
    enabled: !!TRANSAK_API_KEY,
    supportsWithdraw: false,
  },
  {
    id: 'moneygram',
    name: 'MoneyGram',
    blurb: 'Cash in / out at physical agent locations worldwide.',
    enabled: true,
    supportsWithdraw: true,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    blurb: 'Fiat onramp via Stripe. Requires server — coming soon.',
    badge: 'Soon',
    enabled: false,
    supportsWithdraw: false,
  },
];

export const FiatRamp: React.FC<FiatRampProps> = ({
  userPublicKey,
  vaultAddress,
  onWithdrawProposed,
}) => {
  const anchors = useMemo(() => getAnchors(), []);
  const [provider, setProvider] = useState<Provider>('transak');
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
  const activeProvider = PROVIDERS.find((p) => p.id === provider)!;

  // Force deposit mode if the active provider can't withdraw.
  useEffect(() => {
    if (!activeProvider.supportsWithdraw && mode === 'withdraw') {
      setMode('deposit');
    }
  }, [activeProvider, mode]);

  // MoneyGram limits (USDC). Transak handles its own limits in-widget.
  const limits =
    mode === 'deposit' ? { min: 5, max: 950 } : { min: 5, max: 2500 };
  const outOfRange =
    provider === 'moneygram' &&
    numericAmount > 0 &&
    (numericAmount < limits.min || numericAmount > limits.max);

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

  // ---- Transak (card/bank → USDC straight to the vault) ----
  const handleTransak = useCallback(() => {
    setError('');
    if (!TRANSAK_API_KEY) {
      setError('Transak API key is not configured (REACT_APP_TRANSAK_API_KEY).');
      return;
    }
    try {
      setBusy(true);
      setStatus('Opening Transak…');

      // Build the widget URL from query parameters (client-side method).
      const params = new URLSearchParams({
        apiKey: TRANSAK_API_KEY,
        productsAvailed: 'BUY',
        cryptoCurrencyCode: USDC_CODE,
        network: 'stellar',
        walletAddress: vaultAddress,          // deliver straight to the vault
        disableWalletAddressForm: 'true',     // lock the destination
        themeColor: '06b6d4',
      });
      if (numericAmount > 0) {
        params.set('defaultCryptoAmount', String(numericAmount));
      }

      const widgetUrl = `${TRANSAK_BASE_URL}?${params.toString()}`;

      const transakConfig: TransakConfig = { widgetUrl };
      const transak = new Transak(transakConfig);

      transak.init();

      Transak.on(Transak.EVENTS.TRANSAK_WIDGET_CLOSE, () => {
        setBusy(false);
        setStatus('Transak window closed.');
        transak.close();
      });

      Transak.on(Transak.EVENTS.TRANSAK_ORDER_SUCCESSFUL, (orderData: any) => {
        setBusy(false);
        setStatus(
          `Transak order completed. USDC is being delivered to the vault. ` +
            `Order ID: ${orderData?.status?.id ?? orderData?.id ?? 'n/a'}`
        );
        transak.close();
      });

      Transak.on(Transak.EVENTS.TRANSAK_ORDER_FAILED, () => {
        setBusy(false);
        setError('Transak order failed.');
      });
    } catch (e: any) {
      setBusy(false);
      setError(e?.message || 'Failed to open Transak');
    }
  }, [vaultAddress, numericAmount]);

  // ---- MoneyGram (SEP-24) deposit ----
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

  // ---- MoneyGram (SEP-24) withdraw ----
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

  // Primary action router based on provider + mode.
  const handlePrimary = () => {
    if (provider === 'transak') return handleTransak();
    if (provider === 'moneygram') {
      return mode === 'deposit' ? handleDeposit() : handleWithdraw();
    }
    // stripe is disabled
  };

  const showMoneyGramForm = provider === 'moneygram';
  const showFee = numericAmount > 0 && (provider === 'moneygram');

  const canSubmit =
    !!userPublicKey &&
    activeProvider.enabled &&
    !busy &&
    (provider === 'transak'
      ? true
      : !!anchorId && numericAmount >= limits.min && numericAmount <= limits.max);

  const primaryLabel = busy
    ? 'Working…'
    : provider === 'transak'
    ? 'Buy USDC with Transak'
    : mode === 'deposit'
    ? 'Start cash deposit'
    : 'Start cash withdrawal';

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-semibold text-white">Fiat On / Off Ramp</h2>
        <p className="text-sm text-gray-400 mt-1">
          Move money between fiat and USDC. Funds settle directly into your vault.
        </p>
      </div>

      {/* Provider selector cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {PROVIDERS.map((p) => {
          const active = p.id === provider;
          return (
            <button
              key={p.id}
              disabled={!p.enabled}
              onClick={() => p.enabled && setProvider(p.id)}
              className={`text-left rounded-xl border p-4 transition-all ${
                active
                  ? 'border-cyan-500/60 bg-gradient-to-br from-blue-600/20 to-cyan-600/10'
                  : p.enabled
                  ? 'border-gray-700 bg-gray-900/40 hover:border-blue-700/60 hover:bg-gray-800/40'
                  : 'border-gray-800 bg-gray-900/20 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`font-semibold ${active ? 'text-cyan-300' : 'text-white'}`}>
                  {p.name}
                </span>
                {p.badge && (
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
                    {p.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 leading-snug">{p.blurb}</p>
            </button>
          );
        })}
      </div>

      {/* Main panel: two columns on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: form */}
        <div className="lg:col-span-3 rounded-2xl border border-gray-700 bg-gray-900/60 p-5 sm:p-6">
          {/* Mode toggle (only for providers that support withdraw) */}
          {activeProvider.supportsWithdraw && (
            <div className="flex rounded-lg bg-gray-800 p-1 mb-5">
              {(['deposit', 'withdraw'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 text-sm rounded-md capitalize transition-colors ${
                    mode === m ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {m === 'deposit' ? 'Cash → Vault' : 'Vault → Cash'}
                </button>
              ))}
            </div>
          )}

          {/* MoneyGram anchor picker */}
          {showMoneyGramForm && (
            <>
              <label className="block text-xs text-gray-400 mb-1">Anchor</label>
              <select
                value={anchorId}
                onChange={(e) => setAnchorId(e.target.value)}
                className="w-full mb-4 rounded-lg bg-gray-800 text-white p-2.5 text-sm"
              >
                {anchors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.description}
                  </option>
                ))}
              </select>
            </>
          )}

          {/* Amount */}
          <label className="block text-xs text-gray-400 mb-1">
            Amount (USDC){provider === 'transak' ? ' — optional' : ''}
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={
              provider === 'transak'
                ? 'Leave blank to choose in Transak'
                : `${limits.min} – ${limits.max}`
            }
            className="w-full rounded-lg bg-gray-800 text-white p-2.5 text-sm mb-1"
          />
          {provider === 'moneygram' && (
            <p className="text-xs text-gray-500 mb-3">
              Limits: {limits.min}–{limits.max} USDC per transaction
            </p>
          )}

          {outOfRange && (
            <p className="text-xs text-amber-400 mb-3">
              Amount must be between {limits.min} and {limits.max} USDC.
            </p>
          )}

          {/* Primary action */}
          <button
            disabled={!canSubmit}
            onClick={handlePrimary}
            className={`w-full py-3 rounded-lg font-medium text-sm mt-2 transition-colors ${
              canSubmit
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {primaryLabel}
          </button>

          {!activeProvider.enabled && (
            <p className="text-xs text-amber-400 mt-3">
              {provider === 'stripe'
                ? 'Stripe requires the backend service. It will be enabled after server migration.'
                : 'This provider is not configured.'}
            </p>
          )}

          {status && <p className="text-xs text-gray-300 mt-3">{status}</p>}
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </div>

        {/* Right: summary / context */}
        <div className="lg:col-span-2 space-y-4">
          {/* Fee breakdown (MoneyGram) */}
          {showFee && (
            <div className="rounded-2xl border border-gray-700 bg-gray-900/60 p-5">
              <h4 className="text-sm font-semibold text-white mb-3">Summary</h4>
              <div className="text-sm space-y-2">
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
              </div>
              <p className="text-[11px] text-gray-500 pt-3">
                Anchor and network fees are charged separately by{' '}
                {selectedAnchor?.name ?? 'the provider'}.
              </p>
            </div>
          )}

          {/* Provider-specific info card */}
          <div className="rounded-2xl border border-gray-700 bg-gray-900/40 p-5">
            <h4 className="text-sm font-semibold text-white mb-2">How it works</h4>
            {provider === 'transak' && (
              <p className="text-xs text-gray-400 leading-relaxed">
                Pay by card or bank transfer. After KYC, Transak delivers USDC on
                Stellar directly to your vault address. No multisig approval is
                needed for incoming funds.
              </p>
            )}
            {provider === 'moneygram' && (
              <p className="text-xs text-gray-400 leading-relaxed">
                Deposits land directly in the vault. Withdrawals create two
                multisig proposals — the transfer and the 0.3% platform fee —
                which your signers must approve before funds leave the vault.
              </p>
            )}
            {provider === 'stripe' && (
              <p className="text-xs text-gray-400 leading-relaxed">
                Stripe’s crypto onramp creates a session server-side. This will be
                available once the Orion Safe API is deployed to a server.
              </p>
            )}
          </div>

          {/* Destination card */}
          <div className="rounded-2xl border border-gray-700 bg-gray-900/40 p-5">
            <h4 className="text-sm font-semibold text-white mb-2">Destination vault</h4>
            <p className="text-xs font-mono text-gray-400 break-all">{vaultAddress}</p>
          </div>
        </div>
      </div>
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
