import { rpc, TransactionBuilder, BASE_FEE, Contract, Address, nativeToScVal, scValToNative, Account, Keypair, Networks } from "@stellar/stellar-sdk";
import { createClient } from "@supabase/supabase-js";

const RPC_URL = process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE || Networks.TESTNET;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY); // service_role
const server = new rpc.Server(RPC_URL, { allowHttp: true });
const tempAccount = () => new Account(Keypair.random().publicKey(), "0");

async function simRead(contractId, method, args = []) {
  const c = new Contract(contractId);
  const tx = new TransactionBuilder(tempAccount(), { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(c.call(method, ...args)).setTimeout(30).build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${method}: ${sim.error}`);
  return sim.result?.retval ? scValToNative(sim.result.retval) : null;
}

// Reconcile ONE lock from chain into the DB. Idempotent.
export async function reconcileLock(vaultAddress, lockId) {
  let chain;
  try {
    chain = await simRead(vaultAddress, "get_lock", [nativeToScVal(lockId, { type: "u64" })]);
  } catch {
    return; // lock doesn't exist on chain (#18) — leave DB as-is or handle orphans separately
  }
  if (!chain) return;

  const active = Boolean(chain.is_active);
  const released = BigInt(chain.released_amount ?? 0).toString();
  const total = BigInt(chain.total_amount ?? 0).toString();

  // Preserve an existing Cancelled marker; otherwise derive.
  const { data: existing } = await supabase
    .from("locks").select("final_state").eq("vault_address", vaultAddress).eq("lock_id", lockId).maybeSingle();
  let final_state = existing?.final_state ?? null;
  if (active) final_state = null;
  else if (final_state == null) final_state = "FullyReleased";

  await supabase.from("locks").upsert({
    vault_address: vaultAddress,
    lock_id: lockId,
    beneficiary_address: chain.beneficiary,
    token_address: chain.token,
    total_amount: total,
    released_amount: released,
    total_claimed: released,
    lock_type: Number(chain.lock_type),
    is_active: active,
    final_state,
    start_time: new Date(Number(chain.start_time) * 1000).toISOString(),
    end_time: new Date(Number(chain.end_time) * 1000).toISOString(),
    cliff_time: new Date(Number(chain.cliff_time) * 1000).toISOString(),
    release_intervals: Number(chain.release_intervals ?? 0),
    revocable: Boolean(chain.revocable),
    updated_at: new Date().toISOString(),
  }, { onConflict: "vault_address,lock_id" });
}

// Reconcile every lock of one vault.
export async function reconcileVault(vaultAddress) {
  const config = await simRead(vaultAddress, "get_config");
  const lockCount = Number(config.lock_count ?? 0);
  for (let i = 1; i <= lockCount; i++) {
    try { await reconcileLock(vaultAddress, i); } catch (e) { console.error("reconcileLock", vaultAddress, i, e.message); }
  }
}

// Full sweep across all known vaults.
export async function reconcileAll() {
  const { data } = await supabase.from("vaults").select("address").eq("is_active", true);
  const vaults = (data ?? []).map(v => v.address);
  for (const v of vaults) {
    try { await reconcileVault(v); } catch (e) { console.error("reconcileVault", v, e.message); }
  }
  console.log(`[reconciler] swept ${vaults.length} vault(s) @ ${new Date().toISOString()}`);
}

// Start the periodic sweep. Call once from server.js.
export function startReconciler(intervalMs = 60_000) {
  reconcileAll().catch(e => console.error("initial sweep", e));
  setInterval(() => reconcileAll().catch(e => console.error("sweep", e)), intervalMs);
}
