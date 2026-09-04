# Verification

Every factual claim we make about Orion Safe, with the command to check it. If a number here is
wrong, it is a bug — please open an issue.

Last verified: **2026-09-04**, against testnet ledger 4,495,419.

---

## Deployed contracts

All on **Stellar testnet**. Nothing is deployed to mainnet.

| Contract | Address | WASM hash | Last on-chain activity |
|---|---|---|---|
| Factory | `CCNGOW6UCZKELBAR377HDHWAJJLKD6SJHUFCDT4UM6M2AYPSOEBYLDVA` | `796d5c1b…dd810df1` | 2026-06-15 (ledger 3,100,465) |
| Vault (current) | `CBJ4BFOUDMQWFPCBALQTO2565STNGFMGQWDYVQ7MBWRZF5WSI2Z4VT5W` | `f434965d…ebe475ec` | 2026-04-08 (ledger 1,926,506) |
| Vault (initial) | `CDH3LYVDC22E2PF2JMSEHVEA3XI7YU2ICAVNUGC5O6EZ4WC3UWBOPF4P` | `5bf11f2b…f63c5f90` | 2026-03-14 (ledger 1,504,158) |

These columns mean different things, and an earlier version of this page conflated them. The
addresses were confirmed **live** on 2026-09-04 — that is a verification date, not a deployment
date. The last column is the ledger that last modified each contract, converted to its close time:
the vault has seen no on-chain activity since April, the factory none since June. Per-contract
deployment dates are visible on Stellar Expert.

Full hashes:

```
factory         796d5c1b4b21037c097de27ddc4d11af94d89968e2eac0c36619a7aadd810df1
vault (current) f434965dafa094f90a27a09065562da9fe5aeb00f8208da1665bb4ebebe475ec
vault (initial) 5bf11f2b180336ebe51eb6a244211e0292ad8191dc0d6ce0d1edfbcaf63c5f90
```

### Check them yourself

```bash
stellar contract info interface \
  --network testnet \
  --id CCNGOW6UCZKELBAR377HDHWAJJLKD6SJHUFCDT4UM6M2AYPSOEBYLDVA
```

Or without the CLI, straight from RPC:

```bash
node -e "
const S = require('@stellar/stellar-sdk');
const srv = new S.rpc.Server('https://soroban-testnet.stellar.org');
const id = 'CCNGOW6UCZKELBAR377HDHWAJJLKD6SJHUFCDT4UM6M2AYPSOEBYLDVA';
srv.getLedgerEntries(new S.Contract(id).getFootprint()).then(r => {
  const inst = r.entries[0].val.contractData().val().instance();
  console.log('live, wasm hash:', inst.executable().wasmHash().toString('hex'));
});
"
```

### ⚠️ These deployments are out of date

The addresses above predate the proposal-payload binding fix described in the
[security changelog](#security-changelog). They are kept listed because they are what is currently on
chain, and we would rather show a stale-but-real state than a clean-but-false one. Redeployment will
change all three addresses and hashes, and this page will be updated in the same commit.

**Do not use these contracts with real value.** They are unaudited and contain a known
privilege-escalation bug.

---

## Repository statistics

| Claim | Value | Command |
|---|---|---|
| Commits on `main` | **55** (newest 2026-07-23) | `git rev-list --count origin/main` |
| Contributors | **1 primary** (52 commits), 1 occasional (2 commits) | `git shortlog -sn --all` |
| First commit | 2026-03-14 | `git log --reverse --format=%ad --date=short \| head -1` |
| Rust contract code | **1,615 lines** across 3 crates | `wc -l contracts/*/src/lib.rs` |
| Rust test code | **985 lines** | `wc -l contracts/*/src/test.rs` |
| Public contract functions | **51 total** — vault 23, factory 14, registry 14 | `grep -cE '^\s*pub fn ' contracts/*/src/lib.rs` |
| Contract tests | **42** — vault 39, factory 3, registry 0 | `grep -c '#\[test\]' contracts/*/src/test.rs` |
| TypeScript / JavaScript | **~26,600 lines** (dashboard + API) | `find dashboard/src api/src -name '*.ts*' -o -name '*.js' \| xargs wc -l` |
| Licence | MIT, all code | `cat LICENSE` |

### Development has not been continuous

An earlier version of this page described development as continuous since March. It has not been.
The honest cadence, and the gaps, since both are checkable:

| Month | Commits on `main` |
|---|---|
| 2026-03 | 14 |
| 2026-04 | 20 |
| 2026-05 | **2** |
| 2026-06 | 17 |
| 2026-07 | **2** (newest 2026-07-23) |
| 2026-08 | 0 on `main` |

```bash
git log --format=%ad --date=format:'%Y-%m' origin/main | sort | uniq -c
```

May and July were near-dormant, and `main` has had no commits since 23 July. On-chain the picture is
the same: the vault has not been touched since 8 April and the factory not since 15 June. Work in
August happened on a branch rather than on `main` — see the security changelog below — but a reviewer
reading `main` is right to see a project that paused.

### Commit history is not tidy

36 of the 55 commits are named `e` or `debug`. That is poor practice and we are not going to rewrite
history to hide it — a force-push to relabel old commits would be worse than the untidiness. Commit
messages from 2026-08 onward follow a conventional format.

```bash
git log --format=%s | sort | uniq -c | sort -rn | head
```

---

## Test coverage

Contract tests run in CI on every push to `contracts/`:
[.github/workflows/contracts.yml](../.github/workflows/contracts.yml). The workflow builds the WASM,
runs the workspace suite, and publishes a line-coverage report as a build artifact.

**Current state, stated plainly.** Until 2026-08-07 the test modules were never wired into the
crates — `mod test;` was absent from every `lib.rs`, so `cargo test` compiled and reported **zero
tests** while two test files sat unused on disk. One of them no longer matched the contract API and
would not have compiled. The suite has since been rebuilt: 39 vault tests and 3 factory tests, wired
in and running in CI.

Coverage is still below target and the `registry` crate (373 lines) has no tests at all. The CI
coverage gate is deliberately set low and annotated, rather than set to a number we cannot meet:
raising it to ≥85% is active work.

```bash
cd contracts && cargo test --workspace
cd contracts && cargo llvm-cov --workspace --summary-only
```

---

## What we do not have

Listed because a reviewer will find out anyway, and finding out from us costs less.

- **No mainnet deployment.** Testnet only.
- **No security audit.** The contracts are unaudited.
- **No external users, no revenue, no signed agreements.**
- **No policy contracts.** Spending limits, allowlists and per-role caps are designed, not built.
- **Three roles, not five.** `SuperAdmin`, `Admin`, `Executor` exist. `Voter` and `Spender` are
  planned and require contract changes.
- **No passkey signers yet**, though Soroban's native `secp256r1_verify` makes them straightforward.

---

## Security changelog

Five issues found during internal review on 2026-08-07. All fixed in source; **all require
redeployment, which is pending** — the contracts listed above still run the vulnerable code. No real
value was at risk, as they are testnet-only.

| Issue | Severity | Fix |
|---|---|---|
| Proposal payload not bound to proposal | Critical | `ProposalPayload` persisted at propose time; `execute()` takes only a proposal id |
| Committed funds unprotected at execution | Critical | Available-balance check re-applied in `execute()` for transfers and locks |
| Unilateral lock revocation | High | `cancel_lock` removed as a public entry point; now requires an approved `CancelLock` proposal |
| Sole signer could brick a funded vault | High | `leave_vault` refuses the last signer — `CannotLeaveAsLastSigner` |
| Approvals from removed signers still counted | Medium | Execution counts only approvals from current signers, via `get_effective_approvals()` |

### Detail — proposal payload not bound to proposal (critical)

`execute()` accepted the operation — token, recipient, amount, lock timings — as caller-supplied
arguments, while `propose()` stored only the proposal *type*. The payload was emitted as an event and
never persisted. Validation checked that the type matched and that approvals met threshold, nothing
more.

Consequences:

1. **Arbitrary substitution.** An approved "transfer 100 USDC to Alice" could be executed as
   "transfer the entire balance to Bob."
2. **Privilege escalation.** `ProposalType::SetRole` maps `amount == 0` to `Role::SuperAdmin`, so any
   approved `SetRole` proposal could be executed as "make me SuperAdmin."
3. **Committed funds unprotected.** The available-balance check existed only in `propose()`, so a
   transfer could drain funds already committed to a vesting beneficiary.

Fixed by persisting a `ProposalPayload` at propose time and reading it back at execute time.
`execute(executor, proposal_id)` now takes no payload arguments — it cannot be influenced by the
caller. The available-balance check is re-applied at execution for transfers and locks.

Found during internal review. No real value was at risk: the contracts are testnet-only and hold no
production funds. Requires redeployment, which is pending.

---

## Corrections to earlier claims

We have overstated things. Rather than quietly editing, the record:

| Claim | Where | Reality |
|---|---|---|
| "200+ commits" | SCF #44 submission | 55 on `main`; ~39 at the time |
| "Built on OpenZeppelin's Smart Account framework" | README, site, whitepaper, architecture doc | Never true in code. `contracts/Cargo.toml` has only ever declared `soroban-sdk`. Removed everywhere, and the decision not to adopt it is recorded in [ADR 0001](./adr/0001-no-smart-account-framework.md) |
| "5-role system" | README, whitepaper, architecture doc | Three roles implemented; two planned |
| "5 contract tests" | internal notes | Zero were running — the modules were unwired |
| "Testnet contracts coming soon" | README | Contradicted the deployments, which had been live since March. Corrected |
