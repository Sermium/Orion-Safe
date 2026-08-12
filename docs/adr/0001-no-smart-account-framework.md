# ADR 0001 — Orion Safe does not build on a smart-account framework

**Status:** Accepted · **Date:** 2026-08-07

## Context

Soroban has account abstraction via `CustomAccountInterface`, and OpenZeppelin's `stellar-contracts`
provides a Smart Account framework built on it — signers, context rules, and composable policies,
with a public audit behind them. Adopting it would be the conventional choice for a multi-signature
treasury contract.

Orion Safe does not, and this document records why.

## Decision

Orion Safe implements its own contracts against `soroban-sdk` alone. No smart-account framework is
used as the authorization layer.

## Rationale

The two designs disagree about *when* authorization happens.

A smart account resolves authorization **inside a single transaction's `__check_auth`**: a context
rule is selected, signers are authenticated, policies run, the transaction proceeds or fails. To
express M-of-N with this model, signatures are gathered off-chain and submitted together — the
pattern Safe uses on Ethereum.

Orion Safe is an **on-chain proposal queue**:

    propose()   →  writes a proposal to contract storage, emits ProposalCreated
    approve()   →  separate transaction, separate signature, emits ProposalApproved
    reject()    →  separate transaction, recorded explicitly, emits ProposalRejected
    execute()   →  runs the operation once threshold is met, emits ProposalExecuted

Approvals arrive as separate, independently-signed transactions over hours or days. Every one is an
on-chain event, attributable to a signer and timestamped by the ledger.

That event stream is the product. Orion Safe exists to give organisations a disbursement record they
can hand to an auditor, and the record is only as good as what the chain retains. Off-chain
signature collection would keep the *outcome* on-chain while discarding the *deliberation* — who
approved, when, and who declined. It also cannot express an explicit rejection at all: under
signature collection, a dissenting signer is indistinguishable from an absent one.

Adopting a smart-account framework would mean trading the audit trail for a dependency.

## What we give up

**Audited primitives.** This is the real cost, and we do not claim otherwise. Mitigations:

- The trusted surface is deliberately small — three contracts, about 1,600 lines, no framework.
  Auditable by one person in a week, which is only true because nothing was pulled in.
- A ≥85% line coverage target on contract crates, published and CI-gated.
- A professional third-party audit before mainnet.

**Policy interface interop.** Our policies will not plug into other people's smart accounts out of
the box. Mitigated cheaply: the policy trait signature is kept shape-compatible with OpenZeppelin's
— a read-only precheck taking context and signers, returning a typed error. If the ecosystem
converges on a standard, adaptation is a thin shim rather than a rewrite.

## What we do not give up

Everything in the roadmap is reachable with `soroban-sdk` alone:

| Capability | Approach |
|---|---|
| M-of-N multisig | Implemented — `set_threshold`, `add_signer`, `approve` |
| Role-based access control | Implemented — `set_role`, enforced per entry point |
| Proposal lifecycle | Implemented — `propose` / `approve` / `reject` / `execute` |
| Time-locks and vesting | Implemented, live on testnet |
| Locked-vs-spendable segregation | Implemented — `get_token_locked`, `get_available_balance` |
| Spending-limit policy | Separate contract, ~150 lines, called from `execute` |
| Destination allowlist | Separate contract, ~100 lines |
| Passkey / P256 signers | `env.crypto().secp256r1_verify()` — native host function since Protocol 21 (CAP-0051) |
| Upgradeability | Implemented in the factory — `propose_wasm_upgrade` / `execute_wasm_upgrade` |

Notably, a framework would contribute nothing to the two features that most distinguish the product:
vesting bound to the treasury, and the invariant that committed funds cannot be spent by a later
proposal even when it clears the signing threshold. Both are custom logic either way.

## Consequences

- Contract code we write is contract code we own and must audit. Coverage discipline is not
  optional.
- Release cadence is decoupled from any upstream library's versioning against `soroban-sdk`.
- Passkey support requires implementing secp256r1 signer registration ourselves rather than
  configuring a verifier contract.
- We intend to publish the policy contracts as a standalone open-source crate, so the ecosystem gets
  something reusable from work done here.

## Note on prior documentation

Earlier versions of this repository and the project website described the vault as "built on
OpenZeppelin's Smart Account framework." That was never true in code — `contracts/Cargo.toml` has
only ever declared `soroban-sdk`. The claim has been removed everywhere. This ADR records both the
correction and the decision not to adopt the framework going forward.
