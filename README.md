# Orion Safe

**Treasury infrastructure for Stellar — disbursement that survives governance**

[![Built on Soroban](https://img.shields.io/badge/Built%20on-Soroban-blue)](https://soroban.stellar.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Orion Safe is a multi-signature treasury system built natively on Soroban, with no framework
dependencies beyond `soroban-sdk`. Funds committed to a beneficiary — a vesting schedule, a
time-locked payout — cannot be spent by a later proposal, **even one that clears the signing
threshold**. Every approval and rejection is an on-chain event, so the disbursement record is
something an auditor can verify rather than something we assert.

---

## Status

**Testnet. Unaudited. Do not put real value at risk.**

| Contract | Address | Network |
|---|---|---|
| Factory | `CCNGOW6UCZKELBAR377HDHWAJJLKD6SJHUFCDT4UM6M2AYPSOEBYLDVA` | Testnet |
| Vault | `CBJ4BFOUDMQWFPCBALQTO2565STNGFMGQWDYVQ7MBWRZF5WSI2Z4VT5W` | Testnet |
| Vault (earlier) | `CDH3LYVDC22E2PF2JMSEHVEA3XI7YU2ICAVNUGC5O6EZ4WC3UWBOPF4P` | Testnet |

All three verified live on 2026-08-07 via `getLedgerEntries` against `soroban-testnet.stellar.org`.
WASM hashes, reproduction commands, and every other factual claim we make — including the
unflattering ones — are in **[docs/VERIFICATION.md](./docs/VERIFICATION.md)**.

> ⚠️ **These deployments predate the proposal-payload binding fix** (see
> [ADR 0001](./docs/adr/0001-no-smart-account-framework.md) and the changelog below). They are
> scheduled for redeployment, which will change the addresses above. Treat the current testnet
> instances as demonstration only.

### What works today

- Multi-signature vaults created through an on-chain factory, holding any Stellar asset
- Proposal lifecycle — propose, approve, reject, execute — each step an on-chain event
- Three roles: SuperAdmin, Admin, Executor
- Time-locked and vesting disbursement, with cliff and interval-based release
- Locked-versus-spendable balance segregation, enforced at both propose and execute time
- Beneficiary claiming. Locks created with `revocable = true` can be revoked only through an approved
  `CancelLock` proposal — freeing committed funds takes the same threshold as spending them. Locks
  created with `revocable = false` can never be revoked
- Factory-level WASM upgrade path with an admin timelock, plus a version registry
- Dashboard: 13 views, 4 wallet integrations (Freighter, Albedo, xBull, LOBSTR), 16 languages
- Fiat on-ramp via Transak

### Known limitations

- **No signer cap.** The contract does not bound the signer set. Large sets are untested and will
  eventually hit transaction size limits.
- **Approvals are not versioned against configuration changes.** Lowering the threshold makes
  already-approved proposals immediately executable. Signers should treat a threshold change as
  affecting the pending queue, not just future proposals.

Two limitations found in the 2026-08-07 review have since been fixed — see the
[security changelog](#changelog--security).

### What is not built yet

- Policy contracts — spending limits, destination allowlists, per-role caps
- `Voter` and `Spender` roles (see Roles below)
- Passkey / WebAuthn signers
- Compliance export and reconciliation reporting
- Mainnet deployment
- Meaningful test coverage — see Testing

---

## The problem

Stellar has real enterprise adoption: MoneyGram, Circle, Franklin Templeton, UNHCR, and dozens of
anchors and fintechs. Treasury tooling has not kept up.

Stellar's native multisig authorizes *transactions*. It cannot reserve a balance. Neither can
consumer multisig wallets like LOBSTR. So there is no way to express the commitment an organisation
actually needs:

> "400,000 USDC is promised to this contributor over 24 months. A later vote must not be able to
> spend it."

Orion Safe expresses exactly that, at the contract level.

---

## How it works

### Proposal queue, not per-transaction authorization

Authorization accumulates across separate, independently-signed transactions:

```
propose()  → writes the operation to contract storage, emits ProposalCreated
approve()  → separate transaction, separate signature, emits ProposalApproved
reject()   → separate transaction, recorded explicitly, emits ProposalRejected
execute()  → runs the stored operation once threshold is met
```

The operation is **persisted**, not passed to `execute()`. Signers approve a specific transaction,
not a category of transaction. `execute(executor, proposal_id)` takes no payload arguments at all.

This design is why Orion Safe does not build on a smart-account framework — those resolve
authorization inside a single transaction's `__check_auth`, which would move the approval record
off-chain and destroy the audit trail. Full reasoning in
[ADR 0001](./docs/adr/0001-no-smart-account-framework.md).

### Locked versus spendable

```
get_token_locked(token)      → total committed to active locks and vesting schedules
get_available_balance(token) → balance minus locked
```

Both `propose()` and `execute()` check against *available*, never total. Committed funds stay
committed regardless of how many signers approve a competing transfer.

### Roles

**Implemented** (`Role` enum, `contracts/vault/src/lib.rs`):

| Role | Permissions |
|---|---|
| SuperAdmin | Everything, including role assignment and threshold changes |
| Admin | Manage members, propose, approve, execute |
| Executor | Propose, approve, execute |

**Planned** — separating proposal rights from spending rights is a contract change, not a UI change:

| Role | Permissions | Status |
|---|---|---|
| Voter | Approve and reject only, no execution | Planned |
| Spender | Direct transfers within policy limits, no proposal required | Planned, depends on the policy engine |

---

## Why Stellar

| Stellar feature | How Orion Safe uses it |
|---|---|
| Soroban smart contracts | Vault, factory and registry logic; programmable policies |
| Sub-second finality | Approvals confirm while the approver is still looking at the screen |
| $0.00001 fees | A five-signer approval round costs effectively nothing |
| Contract events | The audit trail — every approval and rejection, timestamped by the ledger |
| Native USDC | Treasury denominated in the stablecoin enterprises already hold |
| `secp256r1_verify` host function | Passkey signers without an external verifier contract (planned) |

---

## Project structure

```
contracts/
├── vault/src/lib.rs        # Signers, roles, proposals, locks, vesting
├── factory/src/lib.rs      # Vault deployment, fees, WASM upgrade path
├── registry/src/lib.rs     # Factory versioning and capability discovery
└── Cargo.toml              # Workspace — sole dependency: soroban-sdk
dashboard/                  # React + TypeScript web application
api/                        # Indexer and reconciliation service
database/                   # Supabase schema
docs/
├── adr/                    # Architecture decision records
├── ARCHITECTURE.md         # Technical architecture
└── ...                     # Guides, FAQ, whitepaper
```

Role management and treasury operations live inside the vault contract rather than in separate
contracts — splitting them would add a cross-contract call to every proposal for no isolation
benefit, since they share the vault's storage.

---

## Getting started

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) and the `wasm32v1-none` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli)
- [Node.js](https://nodejs.org/) 18+

### Contracts

```bash
cd contracts
cargo build --release --target wasm32v1-none
cargo test --workspace
```

### Dashboard

```bash
cd dashboard
npm install
npm start
```

---

## Testing

Contract tests run in CI on every push — see
[.github/workflows/contracts.yml](.github/workflows/contracts.yml), which builds the wasm, runs the
workspace suite, and publishes a line-coverage report.

Current state, stated plainly: the suite was recently rebuilt after the test modules were found to be
unwired (`mod test;` was missing, so `cargo test` had been reporting zero tests). Coverage is well
below where it needs to be, and the `registry` crate has no tests at all. Raising contract coverage
to ≥85% with a CI gate is active work, not a claim.

---

## Target users

| Segment | Use case |
|---|---|
| Token issuers | Contributor and investor vesting that survives governance changes |
| Grant programs & foundations | Milestone-based disbursement with an exportable record |
| Anchors & fintechs | Operational treasury, reserve management |
| NGOs & aid organisations | Multi-party disbursement under spending caps |
| DAOs | Governance plus treasury |
| Fund managers | Tokenised fund administration |

---

## Built with

- **Soroban** — Stellar's smart contract platform
- **soroban-sdk** — the only contract dependency, by design
- **Stellar SDK (JS)** — chain interaction from the dashboard
- **React + TypeScript** — dashboard
- **Supabase** — off-chain index, reconciled against on-chain events

---

## Security

The contracts carry no framework dependencies. The trusted surface is three contracts totalling
about 1,600 lines — small enough that one person can audit it properly.

- Minimal, fully open-source contract surface (MIT)
- Line-coverage target of ≥85% on contract crates, CI-gated
- Professional third-party security audit before mainnet

**The current testnet deployment is unaudited and predates a security fix.** Do not use it with real
value.

To report a vulnerability, please open a private security advisory on this repository rather than a
public issue.

### Changelog — security

All four found during internal review on 2026-08-07. No real value was at risk — the contracts are
testnet-only and hold no production funds. All require redeployment, which is pending.

- **Proposal payload not bound to the proposal (critical).** `execute()` accepted the operation
  (token, recipient, amount, lock timings) as caller-supplied arguments while `propose()` stored only
  the proposal *type*. Approvals therefore authorized a category of transaction rather than a specific
  one: an approved "transfer 100 to Alice" could be executed as "transfer everything to Bob", and any
  approved `SetRole` proposal could be executed as "make me SuperAdmin". The payload is now persisted
  at propose time and read back at execute time; `execute(executor, proposal_id)` takes no payload
  arguments at all.
- **Committed funds not protected at execution (critical).** The available-balance check existed only
  in `propose()`, so a transfer approved before a lock was created could drain funds already committed
  to a beneficiary. The check is now re-applied at execution for transfers and locks.
- **Unilateral lock revocation (high).** `cancel_lock` was a public entry point gated on `Role::Admin`
  alone, letting a single Admin free a beneficiary's committed funds with no second approval. It is now
  reachable only through an approved `CancelLock` proposal.
- **Approvals from removed signers still counted (medium).** `remove_signer` left that signer's
  recorded approvals in place, so a proposal could reach threshold on an approval from someone whose
  key had since been revoked. Execution now counts only approvals from addresses currently in the
  signer set, exposed as `get_effective_approvals()`.
- **Sole signer could brick a funded vault (high).** `leave_vault` allowed the last signer to leave,
  emptying the signer set. Nothing could then be proposed, approved or executed again, and
  `add_signer` requires a SuperAdmin who no longer existed — stranding any uncommitted balance
  permanently. Now refused with `CannotLeaveAsLastSigner`.

---

## Contributing

See [CONTRIBUTING.md](./docs/CONTRIBUTING.md).

## License

MIT — see [LICENSE](./LICENSE).

## Links

- [Verification — every claim, with the command to check it](./docs/VERIFICATION.md)
- [Technical architecture](./ARCHITECTURE.md)
- [Architecture decision records](./docs/adr/)
- [Roadmap](./docs/ROADMAP.md)
- [Soroban documentation](https://developers.stellar.org/docs/build/smart-contracts)

## Acknowledgments

- Stellar Development Foundation — for the SCF programme
- Circle — for native USDC on Stellar
