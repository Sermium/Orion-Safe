import { Wallet, IssuedAssetId } from '@stellar/typescript-wallet-sdk';
import { signTransaction } from '../services/walletService';
import { NETWORK, NETWORK_PASSPHRASE } from '../config';
import { proposeTransfer } from './stellar';

// ============================================================================
// PLATFORM FEE
// ============================================================================

export const PLATFORM_FEE_BPS = 30; // 0.3% = 30 basis points
export const PLATFORM_FEE_RECIPIENT =
  process.env.REACT_APP_PLATFORM_FEE_RECIPIENT ||
  'GCSMHTJTHQKGGRHU3GOQGOARVN2QLWUDV57D4KSVP2R3P62YVOALSLHW'; // change me

export interface FeeBreakdown {
  grossAmount: number;       // what the user entered
  platformFee: number;       // your 0.3%
  netAmount: number;         // grossAmount - platformFee
  feeBps: number;
}

/** Compute the 0.3% platform fee on any ramp amount. */
export function computePlatformFee(grossAmount: number): FeeBreakdown {
  const platformFee = (grossAmount * PLATFORM_FEE_BPS) / 10_000;
  return {
    grossAmount,
    platformFee: round7(platformFee),
    netAmount: round7(grossAmount - platformFee),
    feeBps: PLATFORM_FEE_BPS,
  };
}

const round7 = (n: number) => Math.round(n * 1e7) / 1e7; // USDC has 7 decimals on Stellar

// ============================================================================
// ANCHOR REGISTRY  (add/remove anchors here — all speak SEP-24)
// ============================================================================

export interface AnchorInfo {
  id: string;
  name: string;
  homeDomain: string;        // where the anchor's stellar.toml lives
  logo?: string;
  description?: string;
}

// MoneyGram's SEP-24 home domains (verify current values when onboarding).
const ANCHORS_TESTNET: AnchorInfo[] = [
  {
    id: 'moneygram',
    name: 'MoneyGram',
    homeDomain: 'stellar.moneygram.com',
    description: 'Cash in/out at 170+ countries',
  },
  // add other testnet anchors from https://anchors.stellar.org
];

const ANCHORS_MAINNET: AnchorInfo[] = [
  {
    id: 'moneygram',
    name: 'MoneyGram',
    homeDomain: 'stellar.moneygram.com',
    description: 'Cash in/out at 170+ countries',
  },
];

export const getAnchors = (): AnchorInfo[] =>
  NETWORK === 'mainnet' ? ANCHORS_MAINNET : ANCHORS_TESTNET;

export const getAnchor = (id: string): AnchorInfo | undefined =>
  getAnchors().find((a) => a.id === id);

// ============================================================================
// USDC ASSET (the only asset MoneyGram ramps support)
// ============================================================================

const USDC = {
  code: 'USDC',
  // Circle USDC issuers
  issuer:
    NETWORK === 'mainnet'
      ? 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
      : 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5', // testnet
};

// ============================================================================
// WALLET SDK SETUP
// ============================================================================

function getWallet() {
  return NETWORK === 'mainnet' ? Wallet.MainNet() : Wallet.TestNet();
}

/**
 * SEP-10 auth: signs the anchor's challenge transaction with the user's wallet.
 * Returns a bearer token used for the SEP-24 calls.
 */
async function authenticate(homeDomain: string, userPublicKey: string) {
  const wallet = getWallet();
  const anchor = wallet.anchor({ homeDomain });
  const sep10 = await anchor.sep10();

  // Non-custodial flow: the anchor challenges the USER's key; we sign with wallet.
  const authToken = await sep10.authenticate({
    accountKp: {
      publicKey: userPublicKey,
      // The wallet SDK lets us inject a custom signer instead of a secret key:
      sign: async (txXdr: string) => signTransaction(txXdr),
    } as any,
  });

  return { anchor, authToken };
}

// ============================================================================
// DEPOSIT (fiat cash -> USDC into the vault)
// ============================================================================

export interface DepositParams {
  anchorId: string;
  userPublicKey: string;     // the signer initiating + signing SEP-10
  destination: string;       // where USDC lands — usually the VAULT address
  amount?: number;           // optional pre-fill
}

export interface RampSession {
  url: string;               // open this in a popup/webview for KYC + cash instructions
  transactionId: string;     // poll this for status
}

export async function startDeposit(params: DepositParams): Promise<RampSession> {
  const anchorInfo = getAnchor(params.anchorId);
  if (!anchorInfo) throw new Error(`Unknown anchor: ${params.anchorId}`);

  const { anchor, authToken } = await authenticate(
    anchorInfo.homeDomain,
    params.userPublicKey
  );

  const sep24 = await anchor.sep24();
  const asset = new IssuedAssetId(USDC.code, USDC.issuer);

  const resp = await sep24.deposit({
    assetCode: USDC.code,
    authToken,
    destinationAccount: params.destination, // <- vault address: USDC arrives in treasury
    extraFields: params.amount ? { amount: String(params.amount) } : undefined,
  } as any);

  return { url: resp.url, transactionId: resp.id };
}

// ============================================================================
// WITHDRAW (USDC from vault -> fiat cash pickup)
// ============================================================================

export interface WithdrawParams {
  anchorId: string;
  userPublicKey: string;     // signer initiating SEP-10 + proposing the transfer
  vaultAddress: string;      // vault holding the USDC
  vaultUsdcContract: string; // SAC contract id for USDC (deriveSACAddress)
  amount: number;            // gross amount to withdraw
}

export interface WithdrawResult {
  ramp: RampSession;
  fee: FeeBreakdown;
  anchorAccount: string;     // where the vault must send USDC
  anchorMemo?: string;
  feeProposalId?: number;    // your 0.3% proposal
  withdrawProposalId?: number;
}

/**
 * Withdrawal = three coordinated steps:
 *  1. SEP-24 withdraw -> get the anchor's receiving account + memo + KYC URL
 *  2. propose a Transfer of the NET amount from the vault to the anchor
 *  3. propose a Transfer of the 0.3% platform fee from the vault to your fee account
 * Steps 2 & 3 then go through normal multisig approve/execute.
 */
export async function startWithdraw(params: WithdrawParams): Promise<WithdrawResult> {
  const anchorInfo = getAnchor(params.anchorId);
  if (!anchorInfo) throw new Error(`Unknown anchor: ${params.anchorId}`);

  const fee = computePlatformFee(params.amount);

  // 1. SEP-24 withdraw
  const { anchor, authToken } = await authenticate(
    anchorInfo.homeDomain,
    params.userPublicKey
  );
  const sep24 = await anchor.sep24();
  const resp = await sep24.withdraw({
    assetCode: USDC.code,
    authToken,
    extraFields: { amount: String(fee.netAmount) },
  } as any);

  const ramp: RampSession = { url: resp.url, transactionId: resp.id };

  // The anchor account + memo come from polling the transaction's
  // `withdraw_anchor_account` / `withdraw_memo` once it reaches
  // `pending_user_transfer_start`. We surface the session; the UI polls,
  // then calls finalizeWithdraw() below with those values.
  return {
    ramp,
    fee,
    anchorAccount: '', // filled in after polling
    anchorMemo: undefined,
  };
}

/**
 * Called AFTER polling the SEP-24 tx to `pending_user_transfer_start`,
 * once you have the anchor's receiving account + memo.
 * Creates the two multisig Transfer proposals (net withdrawal + 0.3% fee).
 */
export async function finalizeWithdraw(opts: {
  userPublicKey: string;
  vaultAddress: string;
  vaultUsdcContract: string;
  anchorAccount: string;
  fee: FeeBreakdown;
}): Promise<{ withdrawProposalId: number; feeProposalId: number }> {
  const toStroops = (n: number) => BigInt(Math.round(n * 1e7)).toString();

  // 2. Net amount -> anchor (this is what becomes cash)
  const wRes = await proposeTransfer(
    opts.userPublicKey,
    opts.vaultAddress,
    opts.vaultUsdcContract,
    opts.anchorAccount,
    toStroops(opts.fee.netAmount)
  );

  // 3. Platform fee 0.3% -> your fee recipient
  const fRes = await proposeTransfer(
    opts.userPublicKey,
    opts.vaultAddress,
    opts.vaultUsdcContract,
    PLATFORM_FEE_RECIPIENT,
    toStroops(opts.fee.platformFee)
  );

  return {
    withdrawProposalId: extractProposalId(wRes),
    feeProposalId: extractProposalId(fRes),
  };
}

function extractProposalId(res: any): number {
  try {
    if (res?.returnValue) {
      const { scValToNative } = require('@stellar/stellar-sdk');
      return Number(scValToNative(res.returnValue));
    }
  } catch {}
  return 0;
}

// ============================================================================
// STATUS POLLING
// ============================================================================

export async function pollRampStatus(
  anchorId: string,
  userPublicKey: string,
  transactionId: string
) {
  const anchorInfo = getAnchor(anchorId);
  if (!anchorInfo) throw new Error(`Unknown anchor: ${anchorId}`);
  const { anchor, authToken } = await authenticate(
    anchorInfo.homeDomain,
    userPublicKey
  );
  const sep24 = await anchor.sep24();
  return sep24.getTransactionBy({ authToken, id: transactionId } as any);
}
