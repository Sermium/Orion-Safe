import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
// Backend base URL, e.g. https://api.orionsafe.app/api/v1
const API_URL = process.env.REACT_APP_API_URL || '';

interface ProviderMeta {
  id: Provider;
  // Display name + blurb are resolved at render-time via i18n keys
  // (providers.<id>.name / providers.<id>.blurb) so this metadata stays logical.
  supportsWithdraw: boolean;
}

// Static metadata. Whether transak/stripe are usable is resolved at runtime
// from the backend /onramp/status endpoint. MoneyGram is always on (SEP-24).
const PROVIDER_META: ProviderMeta[] = [
  { id: 'transak', supportsWithdraw: false },
  { id: 'moneygram', supportsWithdraw: true },
  { id: 'stripe', supportsWithdraw: false },
];

export const FiatRamp: React.FC<FiatRampProps> = ({
  userPublicKey,
  vaultAddress,
  onWithdrawProposed,
}) => {
  const { t } = useTranslation();
  const anchors = useMemo(() => getAnchors(), []);

  // Runtime availability from the backend.
  const [providerStatus, setProviderStatus] = useState<{ transak: boolean; stripe: boolean }>({
    transak: false,
    stripe: false,
  });

  const isEnabled = useCallback(
    (id: Provider) => {
      if (id === 'moneygram') return true;
      if (id === 'transak') return providerStatus.transak;
      if (id === 'stripe') return providerStatus.stripe;
      return false;
    },
    [providerStatus]
  );

  const [provider, setProvider] = useState<Provider>('moneygram');
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
  const activeMeta = PROVIDER_META.find((p) => p.id === provider)!;

  // Fetch provider availability from the backend on mount.
  useEffect(() => {
    if (!API_URL) return;
    let cancelled = false;
    fetch(`${API_URL}/onramp/status`)
      .then((r) => r.json())
      .then((s) => {
        if (cancelled) return;
        const next = { transak: !!s.transak, stripe: !!s.stripe };
        setProviderStatus(next);
        // Auto-select the first enabled provider (prefer Transak, then MoneyGram).
        if (next.transak) setProvider('transak');
      })
      .catch(() => {
        if (!cancelled) setProviderStatus({ transak: false, stripe: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Force deposit mode if the active provider can't withdraw.
  useEffect(() => {
    if (!activeMeta.supportsWithdraw && mode === 'withdraw') {
      setMode('deposit');
    }
  }, [activeMeta, mode]);

  // MoneyGram limits (USDC). Transak/Stripe handle their own limits in-widget.
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
          setStatus(t('fiatRamp.status.anchorStatus', { status: tx.status }));
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
    [anchorId, userPublicKey, t]
  );

  // ---- Transak (backend-signed widgetUrl → USDC straight to the vault) ----
  const handleTransak = useCallback(async () => {
    setError('');
    if (!API_URL) {
      setError(t('fiatRamp.errors.apiUrlMissing'));
      return;
    }
    try {
      setBusy(true);
      setStatus(t('fiatRamp.status.creatingTransak'));

      const resp = await fetch(`${API_URL}/onramp/transak/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          walletAddress: vaultAddress,
          cryptoCurrencyCode: USDC_CODE,
          network: 'stellar',
          ...(numericAmount > 0 ? { amount: numericAmount } : {}),
        }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || t('fiatRamp.errors.sessionFailed', { status: resp.status }));
      }
      const { widgetUrl } = await resp.json();
      if (!widgetUrl) throw new Error(t('fiatRamp.errors.noWidgetUrl'));

      setStatus(t('fiatRamp.status.openingTransak'));
      const transakConfig: TransakConfig = { widgetUrl };
      const transak = new Transak(transakConfig);
      transak.init();

      Transak.on(Transak.EVENTS.TRANSAK_WIDGET_CLOSE, () => {
        setBusy(false);
        setStatus(t('fiatRamp.status.transakClosed'));
        transak.close();
      });

      Transak.on(Transak.EVENTS.TRANSAK_ORDER_SUCCESSFUL, (orderData: any) => {
        setBusy(false);
        setStatus(
          t('fiatRamp.status.transakSuccess', {
            orderId: orderData?.status?.id ?? orderData?.id ?? t('common.unknown'),
          })
        );
        transak.close();
      });

      Transak.on(Transak.EVENTS.TRANSAK_ORDER_FAILED, () => {
        setBusy(false);
        setError(t('fiatRamp.errors.transakFailed'));
      });
    } catch (e: any) {
      setBusy(false);
      setError(e?.message || t('fiatRamp.errors.openTransakFailed'));
    }
  }, [vaultAddress, numericAmount, t]);

  // ---- Stripe (backend-created onramp session → USDC to the vault) ----
  const handleStripe = useCallback(async () => {
    setError('');
    if (!API_URL) {
      setError(t('fiatRamp.errors.apiUrlMissing'));
      return;
    }
    try {
      setBusy(true);
      setStatus(t('fiatRamp.status.creatingStripe'));

      const resp = await fetch(`${API_URL}/onramp/stripe/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          walletAddress: vaultAddress,
          destinationCurrency: 'usdc',
          destinationNetwork: 'stellar',
          ...(numericAmount > 0 ? { amount: numericAmount } : {}),
        }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || t('fiatRamp.errors.stripeSessionFailed', { status: resp.status }));
      }
      const { clientSecret } = await resp.json();
      if (!clientSecret) throw new Error(t('fiatRamp.errors.noClientSecret'));

      // Stripe-hosted onramp: open with the session secret.
      openPopup(`https://crypto.link.com/?session=${encodeURIComponent(clientSecret)}`);
      setBusy(false);
      setStatus(t('fiatRamp.status.stripeOpened'));
    } catch (e: any) {
      setBusy(false);
      setError(e?.message || t('fiatRamp.errors.startStripeFailed'));
    }
  }, [vaultAddress, numericAmount, t]);

  // ---- MoneyGram (SEP-24) deposit ----
  const handleDeposit = useCallback(async () => {
    setError('');
    setBusy(true);
    setStatus(t('fiatRamp.status.authenticating'));
    try {
      const session = await startDeposit({
        anchorId,
        userPublicKey,
        destination: vaultAddress, // USDC lands directly in the treasury
        amount: numericAmount || undefined,
      });
      setStatus(t('fiatRamp.status.openingCashIn'));
      openPopup(session.url);
      beginPolling(session.transactionId);
    } catch (e: any) {
      setError(e?.message || t('fiatRamp.errors.depositFailed'));
    } finally {
      setBusy(false);
    }
  }, [anchorId, userPublicKey, vaultAddress, numericAmount, beginPolling, t]);

  // ---- MoneyGram (SEP-24) withdraw ----
  const handleWithdraw = useCallback(async () => {
    setError('');
    setBusy(true);
    setStatus(t('fiatRamp.status.authenticating'));
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

      setStatus(t('fiatRamp.status.openingCashOut'));
      openPopup(res.ramp.url);

      // Wait for the anchor to give us its receiving account + memo,
      // then create the multisig proposals (net withdrawal + 0.3% fee).
      beginPolling(res.ramp.transactionId, async (tx) => {
        setStatus(t('fiatRamp.status.creatingProposals'));
        const anchorAccount = tx.withdraw_anchor_account || tx.to;
        const ids = await finalizeWithdraw({
          userPublicKey,
          vaultAddress,
          vaultUsdcContract: usdcContract,
          anchorAccount,
          fee: res.fee,
        });
        setStatus(
          t('fiatRamp.status.proposalsCreated', {
            withdrawId: ids.withdrawProposalId,
            feeId: ids.feeProposalId,
          })
        );
        onWithdrawProposed?.(ids);
      });
    } catch (e: any) {
      setError(e?.message || t('fiatRamp.errors.withdrawFailed'));
    } finally {
      setBusy(false);
    }
  }, [anchorId, userPublicKey, vaultAddress, numericAmount, beginPolling, onWithdrawProposed, t]);

  // Primary action router based on provider + mode.
  const handlePrimary = () => {
    if (provider === 'transak') return handleTransak();
    if (provider === 'stripe') return handleStripe();
    if (provider === 'moneygram') {
      return mode === 'deposit' ? handleDeposit() : handleWithdraw();
    }
  };

  const showMoneyGramForm = provider === 'moneygram';
  const showFee = numericAmount > 0 && provider === 'moneygram';
  const usesWidget = provider === 'transak' || provider === 'stripe';

  const canSubmit =
    !!userPublicKey &&
    isEnabled(provider) &&
    !busy &&
    (usesWidget
      ? true
      : !!anchorId && numericAmount >= limits.min && numericAmount <= limits.max);

  const primaryLabel = busy
    ? t('fiatRamp.actions.working')
    : provider === 'transak'
    ? t('fiatRamp.actions.buyWithTransak')
    : provider === 'stripe'
    ? t('fiatRamp.actions.buyWithStripe')
    : mode === 'deposit'
    ? t('fiatRamp.actions.startDeposit')
    : t('fiatRamp.actions.startWithdrawal');

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-semibold text-white">{t('fiatRamp.title')}</h2>
        <p className="text-sm text-gray-400 mt-1">{t('fiatRamp.subtitle')}</p>
      </div>

      {/* Provider selector cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {PROVIDER_META.map((p) => {
          const active = p.id === provider;
          const enabled = isEnabled(p.id);
          return (
            <button
              key={p.id}
              disabled={!enabled}
              onClick={() => enabled && setProvider(p.id)}
              className={`text-left rounded-xl border p-4 transition-all ${
                active
                  ? 'border-cyan-500/60 bg-gradient-to-br from-blue-600/20 to-cyan-600/10'
                  : enabled
                  ? 'border-gray-700 bg-gray-900/40 hover:border-blue-700/60 hover:bg-gray-800/40'
                  : 'border-gray-800 bg-gray-900/20 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`font-semibold ${active ? 'text-cyan-300' : 'text-white'}`}>
                  {t(`fiatRamp.providers.${p.id}.name`)}
                </span>
                {!enabled && p.id !== 'moneygram' && (
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
                    {t('fiatRamp.soon')}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 leading-snug">
                {t(`fiatRamp.providers.${p.id}.blurb`)}
              </p>
            </button>
          );
        })}
      </div>

      {/* Main panel: two columns on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: form */}
        <div className="lg:col-span-3 rounded-2xl border border-gray-700 bg-gray-900/60 p-5 sm:p-6">
          {/* Mode toggle (only for providers that support withdraw) */}
          {activeMeta.supportsWithdraw && (
            <div className="flex rounded-lg bg-gray-800 p-1 mb-5">
              {(['deposit', 'withdraw'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 text-sm rounded-md transition-colors ${
                    mode === m ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {m === 'deposit'
                    ? t('fiatRamp.mode.cashToVault')
                    : t('fiatRamp.mode.vaultToCash')}
                </button>
              ))}
            </div>
          )}

          {/* MoneyGram anchor picker */}
          {showMoneyGramForm && (
            <>
              <label className="block text-xs text-gray-400 mb-1">
                {t('fiatRamp.fields.anchor')}
              </label>
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
            {usesWidget
              ? t('fiatRamp.fields.amountOptional')
              : t('fiatRamp.fields.amount')}
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={
              usesWidget
                ? t('fiatRamp.fields.amountWidgetPlaceholder')
                : t('fiatRamp.fields.amountRangePlaceholder', {
                    min: limits.min,
                    max: limits.max,
                  })
            }
            className="w-full rounded-lg bg-gray-800 text-white p-2.5 text-sm mb-1"
          />
          {provider === 'moneygram' && (
            <p className="text-xs text-gray-500 mb-3">
              {t('fiatRamp.fields.limits', { min: limits.min, max: limits.max })}
            </p>
          )}

          {outOfRange && (
            <p className="text-xs text-amber-400 mb-3">
              {t('fiatRamp.fields.outOfRange', { min: limits.min, max: limits.max })}
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

          {!isEnabled(provider) && (
            <p className="text-xs text-amber-400 mt-3">
              {!API_URL
                ? t('fiatRamp.notEnabled.noApiUrl')
                : t('fiatRamp.notEnabled.serverDisabled')}
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
              <h4 className="text-sm font-semibold text-white mb-3">
                {t('fiatRamp.summary.title')}
              </h4>
              <div className="text-sm space-y-2">
                <Row
                  label={t('fiatRamp.summary.amount')}
                  value={t('fiatRamp.summary.usdcValue', { value: fee.grossAmount.toFixed(2) })}
                />
                <Row
                  label={t('fiatRamp.summary.platformFee', {
                    pct: (PLATFORM_FEE_BPS / 100).toFixed(2),
                  })}
                  value={`-${t('fiatRamp.summary.usdcValue', {
                    value: fee.platformFee.toFixed(4),
                  })}`}
                />
                <div className="border-t border-gray-700 my-1" />
                <Row
                  label={
                    mode === 'deposit'
                      ? t('fiatRamp.summary.youReceive')
                      : t('fiatRamp.summary.sentToAnchor')
                  }
                  value={t('fiatRamp.summary.usdcValue', { value: fee.netAmount.toFixed(4) })}
                  strong
                />
              </div>
              <p className="text-[11px] text-gray-500 pt-3">
                {t('fiatRamp.summary.anchorFeesNote', {
                  provider: selectedAnchor?.name ?? t('fiatRamp.summary.theProvider'),
                })}
              </p>
            </div>
          )}

          {/* Provider-specific info card */}
          <div className="rounded-2xl border border-gray-700 bg-gray-900/40 p-5">
            <h4 className="text-sm font-semibold text-white mb-2">
              {t('fiatRamp.howItWorks.title')}
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              {t(`fiatRamp.howItWorks.${provider}`)}
            </p>
          </div>

          {/* Destination card */}
          <div className="rounded-2xl border border-gray-700 bg-gray-900/40 p-5">
            <h4 className="text-sm font-semibold text-white mb-2">
              {t('fiatRamp.destination.title')}
            </h4>
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
