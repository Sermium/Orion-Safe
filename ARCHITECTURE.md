#### Orion Safe — Technical Architecture Document

1. Overview
Orion Safe is a treasury management platform built natively on Soroban with no framework dependencies beyond `soroban-sdk`. It provides programmable multi-signature vaults with policy enforcement, role-based access control, and native USDC support.

┌─────────────────────────────────────────────────────────────┐
│                        ORION SAFE                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │           VAULT ACCOUNT (G...)                      │   │
│   │   • Holds XLM, USDC, any Stellar asset              │   │
│   │   • Receives payments directly                      │   │
│   │   • Controlled ONLY by the smart contract           │   │
│   └─────────────────────────────────────────────────────┘   │
│                            │                                │
│                            ▼                                │
│   ┌─────────────────────────────────────────────────────┐   │
│   │           SMART CONTRACT (C...)                     │   │
│   │   • Multisig logic (M-of-N)                         │   │
│   │   • Locked vs. spendable balance segregation        │   │
│   │   • Role-based access                               │   │
│   │   • Signs transactions on behalf of vault account   │   │
│   └─────────────────────────────────────────────────────┘   │
│                            │                                │
│                            ▼                                │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              SIGNERS (G... addresses)               │   │
│   │   • Propose transactions                            │   │
│   │   • Approve transactions                            │   │
│   │   • Cannot move funds directly                      │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

## Design Principles
- Security-first: Minimal trusted surface — three contracts, no external framework, small enough to audit properly
- Enterprise-native: Designed for institutional workflows and compliance requirements
- Modular: Extensible architecture allowing custom policies and integrations
- Stellar-optimized: Leverages Stellar's native capabilities (low fees, fast finality, native USDC)

2. System Architecture

Legend: ✅ implemented · ⏳ planned

┌─────────────────────────────────────────────────────────────────────┐
│                            ORION SAFE                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│   │   Web App   │    │  Indexer /  │    │  TS Client  │             │
│   │ (Dashboard) │    │  Reconciler │    │             │             │
│   │      ✅     │    │      ✅     │    │      ⏳     │             │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘             │
│          │                  │                  │                    │
│          └──────────────────┼──────────────────┘                    │
│                             │                                       │
│                             ▼                                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                   SOROBAN SMART CONTRACTS                   │   │
│   │                  (soroban-sdk only, no framework)           │   │
│   ├─────────────────────────────────────────────────────────────┤   │
│   │                                                             │   │
│   │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐    │   │
│   │  │   REGISTRY ✅ │─▶│   FACTORY  ✅ │─▶│    VAULT   ✅ │    │   │
│   │  │ • versioning  │  │ • deployment  │  │ • signers     │    │   │
│   │  │ • capability  │  │ • fees        │  │ • roles       │    │   │
│   │  │   discovery   │  │ • WASM upgrade│  │ • proposals   │    │   │
│   │  └───────────────┘  └───────────────┘  │ • locks       │    │   │
│   │                                        │ • vesting     │    │   │
│   │                                        └───────┬───────┘    │   │
│   │                                                │            │   │
│   │                          cross-contract call   │            │   │
│   │                          from execute()        ▼            │   │
│   │                     ┌──────────────────────────────────┐    │   │
│   │                     │        POLICY CONTRACTS          │    │   │
│   │                     ├──────────────┬───────────────────┤    │   │
│   │                     │ SpendLimit ⏳│ Allowlist      ⏳ │    │   │
│   │                     │ RoleLimit  ⏳│                   │    │   │
│   │                     └──────────────┴───────────────────┘    │   │
│   │                                                             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                 │                                   │
│                                 ▼                                   │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                      STELLAR NETWORK                        │   │
│   │      • Native USDC   • Contract events   • Anchors          │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

Time-locking and vesting are implemented inside the vault rather than as policy contracts, because
they hold state that must outlive any individual policy — see §5.

3. Authorization Model

Orion Safe uses an **on-chain proposal queue**, not a per-transaction authorization hook. This is
the central architectural decision and it is deliberate — see
[ADR 0001](./docs/adr/0001-no-smart-account-framework.md) for why we do not build on a smart-account
framework.

## Proposal lifecycle

Authorization accumulates across multiple independently-signed transactions rather than resolving
inside a single `__check_auth` call:

    propose()   →  writes a proposal to contract storage, emits ProposalCreated
    approve()   →  separate transaction, separate signature, emits ProposalApproved
    reject()    →  separate transaction, recorded explicitly, emits ProposalRejected
    execute()   →  runs the operation once threshold is met, emits ProposalExecuted

The consequence that matters: **every approval and rejection is an on-chain event**, attributable to
a signer and timestamped by the ledger. That record is what the compliance audit trail is built
from. A signature-collection model — where approvals are gathered off-chain and submitted together
— cannot produce it, and has no way to express an explicit rejection at all.

## WHO: Signers

Controls who can authorize. Implemented in `contracts/vault/src/lib.rs`.

| Signer type | Status |
|---|---|
| Ed25519 — standard Stellar keypair | Implemented |
| Soroban account — contract as signer | Implemented |
| P256 / WebAuthn passkey | Planned, via Soroban's native `secp256r1_verify` host function (CAP-0051, Protocol 21) |

Each signer carries exactly one role. Threshold is M-of-N over the signer set.

## WHAT: Roles

Defines what each signer may do. Enforced at every mutating entry point.

**Implemented today** — `Role` enum in `contracts/vault/src/lib.rs:17`:

| Role | May |
|---|---|
| SuperAdmin | Everything, including role assignment and threshold changes |
| Admin | Manage members, propose, approve, execute |
| Executor | Propose, approve, execute |

**Planned** — the two additional roles that separate proposal rights from spending rights:

| Role | May | Status |
|---|---|---|
| Voter | Approve and reject only — no execution rights | Planned |
| Spender | Direct transfers within policy limits, no proposal required | Planned, depends on RoleLimitPolicy |

Splitting `Executor` into propose / approve / execute rights is a contract change, not a UI change.

## HOW: Policies

Policy contracts are called from `execute()` before an operation runs. They are separate deployed
contracts rather than vault-internal logic, so they can be swapped without redeploying the vault.

    // Policy interface — read-only precheck, typed rejection
    pub trait Policy {
        fn check(
            env: &Env,
            context: &OperationContext,
            signers: &Vec<Address>,
        ) -> Result<(), PolicyError>;
    }

This signature intentionally mirrors the shape of OpenZeppelin's policy trait. We do not take the
dependency, but keeping the shape compatible means our policies could later be adapted to plug into
OZ smart accounts without a rewrite.

| Policy | Status |
|---|---|
| SpendLimitPolicy — per-period caps | Planned (Tranche #1) |
| AllowlistPolicy — destination restrictions | Planned (Tranche #2) |
| RoleLimitPolicy — per-role spending caps | Planned (Tranche #2) |

Time-locking and vesting are **not** policies. They are implemented directly in the vault, because
they hold state that must survive independently of any policy contract — see §5.

## Locked vs. spendable balance

The vault tracks committed funds separately from available funds:

    get_token_locked(token)      → total committed to active locks and vesting schedules
    get_available_balance(token) → total balance minus locked

`execute()` checks against available balance, not total balance. Once funds are committed to a
beneficiary, no later proposal can spend them — **including one that clears the signing threshold**.
This invariant cannot be expressed by Stellar's native multisig, and no framework provides it.

4. Smart Contract Architecture

## Contract Structure

Current layout (as built):

contracts/
├── vault/
│   └── src/lib.rs              # Vault: signers, roles, proposals, locks, vesting (800 LOC)
├── factory/
│   └── src/lib.rs              # Vault deployment, fees, WASM upgrade path (313 LOC)
├── registry/
│   └── src/lib.rs              # Factory versioning and capability discovery (373 LOC)
└── Cargo.toml                  # Workspace — sole dependency: soroban-sdk

Planned additions (funded scope):

contracts/policies/
├── spend_limit/src/lib.rs      # Per-period spending caps        (Tranche #1)
├── allowlist/src/lib.rs        # Destination restrictions        (Tranche #2)
└── role_limit/src/lib.rs       # Per-role spending caps          (Tranche #2)

Role management and treasury operations live inside the vault contract rather than in separate
contracts — splitting them would add cross-contract call overhead to every proposal for no
isolation benefit, since they share the vault's storage anyway.

## Core Vault Contract
#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, Vec, BytesN, Symbol};

#[contract]
pub struct StellarVault;

#[contractimpl]
impl StellarVault {
    /// Initialize a new vault
    pub fn initialize(
        env: Env,
        name: Symbol,
        signers: Vec<SignerConfig>,
        threshold: u32,
        policies: Vec<Address>,
    ) -> Result<(), VaultError> {
        // Store vault configuration
        // Register signers with their roles, validate threshold
        // Attach policy contracts
    }

    /// Propose a transaction
    pub fn propose(
        env: Env,
        proposer: Address,
        operation: Operation,
        memo: Option<String>,
    ) -> Result<u64, VaultError> {
        // Verify proposer has PROPOSER role
        // Validate operation against context rules
        // Create pending transaction
        // Emit ProposalCreated event
    }

    /// Approve a pending transaction
    pub fn approve(
        env: Env,
        voter: Address,
        proposal_id: u64,
    ) -> Result<(), VaultError> {
        // Verify voter has VOTER role
        // Record approval
        // Check if threshold met
        // Emit ApprovalRecorded event
    }

    /// Execute an approved transaction
    pub fn execute(
        env: Env,
        executor: Address,
        proposal_id: u64,
    ) -> Result<(), VaultError> {
        // Verify executor has EXECUTOR role
        // Verify approval threshold met
        // Validate against all policies
        // Execute operation
        // Record in audit trail
        // Emit TransactionExecuted event
    }

    /// Direct spend (within policy limits)
    pub fn spend(
        env: Env,
        spender: Address,
        token: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), VaultError> {
        // Verify spender has SPENDER role
        // Validate against spend policies
        // Execute transfer
        // Update spend tracking
        // Emit SpendExecuted event
    }
}

## Policy Contracts
Spend Limit Policy

#[contract]
pub struct SpendLimitPolicy;

#[contractimpl]
impl SpendLimitPolicy {
    pub fn initialize(
        env: Env,
        vault: Address,
        token: Address,
        daily_limit: i128,
        per_tx_limit: i128,
    ) -> Result<(), PolicyError>;

    pub fn validate(
        env: Env,
        context: TransactionContext,
    ) -> Result<(), PolicyError> {
        // Check per-transaction limit
        // Check daily aggregate limit
        // Return Ok or PolicyError::LimitExceeded
    }

    pub fn get_remaining_daily(
        env: Env,
        token: Address,
    ) -> i128;
}

## Time Lock Policy
#[contract]
pub struct TimeLockPolicy;

#[contractimpl]
impl TimeLockPolicy {
    pub fn initialize(
        env: Env,
        vault: Address,
        delay_seconds: u64,          // Required delay
        threshold_amount: i128,       // Amount triggering delay
        emergency_threshold: u32,     // Signers to bypass
    ) -> Result<(), PolicyError>;

    pub fn validate(
        env: Env,
        context: TransactionContext,
    ) -> Result<(), PolicyError> {
        // If amount > threshold, check time delay
        // Allow bypass with emergency_threshold signers
    }
}

5. Role-Based Access Control

## Role Definitions

Implemented today — the `Role` enum in `contracts/vault/src/lib.rs`. Privilege is ordered by
discriminant, and `require_role(caller, max_role)` admits any role at or above the level given.

Role	        Description	            Permissions
SuperAdmin	    Vault owner	            Everything: role assignment, threshold changes, member management
Admin	        Vault administrator	    Manage members, propose, approve, execute
Executor	    Signer	                Propose, approve, reject, execute

Planned. Both split rights that `Executor` currently bundles together, so each is a contract change
rather than a UI change:

Role	        Description	            Permissions	                                    Status
Voter	        Approval authority	    Approve or reject only — no execution	        Planned
Spender	        Direct spender	        Transfer within policy limits, no proposal	    Planned, needs RoleLimitPolicy

## Role Assignment
pub struct RoleConfig {
    pub role: Role,
    pub signer: Address,
    pub constraints: Option<RoleConstraints>,
}

pub struct RoleConstraints {
    pub max_amount: Option<i128>,      // Max amount for this role
    pub allowed_tokens: Option<Vec<Address>>, // Restricted tokens
    pub allowed_destinations: Option<Vec<Address>>, // Restricted destinations
    pub time_window: Option<TimeWindow>, // Active hours
}

## Transaction Flow
┌─────────┐      ┌─────────┐     ┌─────────┐      ┌─────────┐
│Proposer │────▶│ Voters  │────▶│Executor │────▶│ Stellar │
│         │      │(M-of-N) │     │         │      │ Network │
└─────────┘      └─────────┘     └─────────┘      └─────────┘
     │               │               │               │
     │  propose()    │   approve()   │   execute()   │
     │───────────────▶              │                │
     │               │───────────────▶               │
     │               │               │───────────────▶
     │               │               │               │
     ▼               ▼               ▼               ▼
┌─────────────────────────────────────────────────────────┐
│                    POLICY VALIDATION                    │
│  • Spend limits  • Time locks  • Allowlists  • Roles    │
└─────────────────────────────────────────────────────────┘

6. USDC Integration

## Native USDC Support
Orion Safe provides first-class support for Circle's USDC on Stellar:

impl StellarVault {
    /// USDC-optimized transfer
    pub fn transfer_usdc(
        env: Env,
        spender: Address,
        to: Address,
        amount: i128,
        memo: Option<String>,
    ) -> Result<(), VaultError> {
        let usdc_contract = get_usdc_contract(&env);
        // Validate against USDC-specific policies
        // Execute transfer
        // Record for compliance reporting
    }

    /// Batch USDC payments (payroll, disbursements)
    pub fn batch_transfer_usdc(
        env: Env,
        executor: Address,
        payments: Vec<Payment>,
    ) -> Result<Vec<PaymentResult>, VaultError>;
}

## USDC Contract Address
- Mainnet: CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75
- Testnet: CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA

7. Stellar-Specific Optimizations

## Leveraging Stellar's Strengths
Stellar                         Feature	How We Use It
Sub-second finality	            Real-time treasury operations, instant policy enforcement
$0.00001 fees	                Cost-effective for high-volume enterprise operations
Contract events	                The audit trail — every approval and rejection, timestamped by the ledger
Protocol 23 optimizations	    Efficient cross-contract calls for policy validation
secp256r1_verify host function	Passkey signers without an external verifier contract (planned)
Anchor network	                Fiat on/off ramp integrations

## Soroban-Specific Design
// Optimized storage using Soroban's storage types
#[contracttype]
pub enum StorageKey {
    VaultConfig,                    // Instance storage (persistent)
    Signer(Address),               // Persistent storage
    Policy(Address),               // Persistent storage
    Proposal(u64),                 // Temporary storage (auto-expire)
    DailySpend(Address, u64),      // Temporary storage (24h TTL)
}

// Efficient event emission for indexing
#[contracttype]
pub struct TransactionEvent {
    pub vault: Address,
    pub tx_type: Symbol,
    pub amount: i128,
    pub token: Address,
    pub timestamp: u64,
}

8. Security Considerations

## Security Model
Smart Contract Security
- Minimal trusted surface: three contracts, ~1,600 lines, no external framework dependencies
- Target of ≥85% line coverage on contract code, published and CI-gated
- Professional third-party security audit before mainnet (funded by Sermium — audits are not an
  eligible SCF budget category)

Access Control Security
- Role separation prevents single points of failure
- Time locks for high-value transactions
- Emergency recovery with elevated thresholds

Operational Security
- All transactions logged on-chain
- Immutable audit trail
- Real-time monitoring capabilities

## Threat Mitigations
Threat	                Mitigation
Compromised signer	    M-of-N threshold, role separation
Malicious proposal	    Voter approval required, policy validation
Unauthorized spend	    Spend limits, allowlists, role verification
Smart contract bug	    Small auditable surface, ≥85% test coverage, professional audit, upgradability
Key loss	            Recovery mechanism with time delay

9. Dashboard Architecture

## Tech Stack
- Frontend: React + TypeScript
- Wallet Integration: Freighter SDK
- Blockchain Interaction: stellar-sdk, soroban-client
- State Management: React Query
- UI Framework: Tailwind CSS + shadcn/ui

## Dashboard Features
┌─────────────────────────────────────────────────────────────┐
│                    ORION SAFE DASHBOARD                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  VAULT OVERVIEW                                     │    │
│  │  • Balance: 1,250,000 USDC                          │    │
│  │  • Pending: 3 transactions                          │    │
│  │  • Members: 5 signers                               │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐         │
│  │  PENDING APPROVALS   │  │  RECENT ACTIVITY     │         │
│  │  ┌────────────────┐  │  │  • TX #45 executed   │         │
│  │  │ TX #47         │  │  │  • TX #44 executed   │         │
│  │  │ 50,000 USDC    │  │  │  • Policy updated    │         │
│  │  │ 1/3 approved   │  │  │  • Member added      │         │
│  │  │ [Approve]      │  │  │                      │         │
│  │  └────────────────┘  │  └──────────────────────┘         │
│  └──────────────────────┘                                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  POLICIES                                           │    │
│  │  • Daily limit: $100,000 (used: $35,000)            │    │
│  │  • Per-tx limit: $25,000                            │    │
│  │  • Time lock: 24h for >$50,000                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘

10. Future Extensions

## Phase 2: DeFi Strategy Vaults
- Automated yield strategies
- Lending protocol integration
- Liquidity provision management

## Phase 3: Cross-Border Automation
- Scheduled payments
- FX conversion rules
- Anchor integration for fiat settlement

## Phase 4: Multi-Chain
- Cross-chain vault management
- Bridge integrations
- Unified treasury across chains

11. References

- Soroban Documentation
- Stellar Protocol 23
- CAP-0051 — secp256r1 verification (passkey signers)
- Circle USDC on Stellar

Document Version: 1.0 Last Updated: March 2026 