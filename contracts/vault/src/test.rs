#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env, Symbol,
};

// ============================================================================
// FIXTURE
// ============================================================================

const FEE: i128 = 1_000_000; // DEFAULT_TX_FEE
const SIGNER_FUNDS: i128 = 1_000 * FEE; // plenty for fees
const VAULT_FUNDS: i128 = 1_000_000_000;

/// Holds the Env and addresses only. The generated client borrows the Env, so
/// it is built on demand via `client()` rather than stored alongside it.
struct Fixture {
    env: Env,
    vault: Address,
    /// signers[0] is SuperAdmin, the rest are Executors.
    signers: [Address; 3],
    token: Address,
    fee_recipient: Address,
}

impl Fixture {
    /// Vault with 3 signers, threshold 2, funded with VAULT_FUNDS of `token`.
    /// The same token is used for fees, so every signer is funded too.
    fn new() -> Fixture {
        let env = Env::default();
        env.mock_all_auths();

        let vault = env.register(StellarVault, ());

        let token_admin = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(token_admin);
        let token = sac.address();
        let minter = token::StellarAssetClient::new(&env, &token);

        let signers = [
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        ];
        for s in signers.iter() {
            minter.mint(s, &SIGNER_FUNDS);
        }
        minter.mint(&vault, &VAULT_FUNDS);

        let fee_recipient = Address::generate(&env);

        StellarVaultClient::new(&env, &vault).initialize(
            &Symbol::new(&env, "TestVault"),
            &soroban_sdk::vec![&env, signers[0].clone(), signers[1].clone(), signers[2].clone()],
            &2u32,
            &fee_recipient,
            &token,
        );

        Fixture { env, vault, signers, token, fee_recipient }
    }

    fn client(&self) -> StellarVaultClient<'_> {
        StellarVaultClient::new(&self.env, &self.vault)
    }

    fn balance(&self, who: &Address) -> i128 {
        token::Client::new(&self.env, &self.token).balance(who)
    }

    /// Every mutating vault call charges the caller DEFAULT_TX_FEE, so any
    /// address that will call one needs a balance first.
    fn fund(&self, who: &Address, amount: i128) {
        token::StellarAssetClient::new(&self.env, &self.token).mint(who, &amount);
    }

    /// Proposes a transfer and approves it to threshold. Returns proposal id.
    fn approved_transfer(&self, to: &Address, amount: i128) -> u64 {
        let id = self.client().propose(
            &self.signers[0],
            &ProposalType::Transfer,
            &self.token,
            to,
            &amount,
            &0u64, &0u64, &0u64, &0u64, &false,
            &Symbol::new(&self.env, "transfer"),
        );
        self.client().approve(&self.signers[1], &id);
        id
    }

    /// Proposes a time-lock and approves it to threshold. Returns proposal id.
    fn approved_timelock(&self, beneficiary: &Address, amount: i128, end_time: u64) -> u64 {
        let id = self.client().propose(
            &self.signers[0],
            &ProposalType::TimeLock,
            &self.token,
            beneficiary,
            &amount,
            &0u64, &end_time, &0u64, &1u64, &true,
            &Symbol::new(&self.env, "lock"),
        );
        self.client().approve(&self.signers[1], &id);
        id
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

#[test]
fn initialize_sets_config() {
    let f = Fixture::new();
    let config = f.client().get_config();
    assert_eq!(config.threshold, 2);
    assert_eq!(config.signer_count, 3);
    assert_eq!(config.proposal_count, 0);
    assert_eq!(config.lock_count, 0);
}

#[test]
fn initialize_assigns_first_signer_super_admin_rest_executor() {
    let f = Fixture::new();
    assert_eq!(f.client().get_role(&f.signers[0]), Role::SuperAdmin);
    assert_eq!(f.client().get_role(&f.signers[1]), Role::Executor);
    assert_eq!(f.client().get_role(&f.signers[2]), Role::Executor);
}

#[test]
fn initialize_rejects_zero_threshold() {
    let env = Env::default();
    let vault = env.register(StellarVault, ());
    let client = StellarVaultClient::new(&env, &vault);
    let a = Address::generate(&env);
    assert_eq!(
        client.try_initialize(
            &Symbol::new(&env, "V"),
            &soroban_sdk::vec![&env, a.clone()],
            &0u32,
            &a,
            &a,
        ),
        Err(Ok(VaultError::InvalidThreshold))
    );
}

#[test]
fn initialize_rejects_threshold_above_signer_count() {
    let env = Env::default();
    let vault = env.register(StellarVault, ());
    let client = StellarVaultClient::new(&env, &vault);
    let a = Address::generate(&env);
    assert_eq!(
        client.try_initialize(
            &Symbol::new(&env, "V"),
            &soroban_sdk::vec![&env, a.clone()],
            &2u32,
            &a,
            &a,
        ),
        Err(Ok(VaultError::InvalidThreshold))
    );
}

#[test]
fn initialize_twice_fails() {
    let f = Fixture::new();
    assert_eq!(
        f.client().try_initialize(
            &Symbol::new(&f.env, "Again"),
            &soroban_sdk::vec![&f.env, f.signers[0].clone()],
            &1u32,
            &f.fee_recipient,
            &f.token,
        ),
        Err(Ok(VaultError::AlreadyInitialized))
    );
}

// ============================================================================
// PROPOSAL LIFECYCLE
// ============================================================================

#[test]
fn propose_starts_ids_at_one_and_self_approves() {
    let f = Fixture::new();
    let to = Address::generate(&f.env);
    let id = f.client().propose(
        &f.signers[0],
        &ProposalType::Transfer,
        &f.token,
        &to,
        &1_000i128,
        &0u64, &0u64, &0u64, &0u64, &false,
        &Symbol::new(&f.env, "t"),
    );
    assert_eq!(id, 1, "proposal ids start at 1");

    let p = f.client().get_proposal(&id);
    assert_eq!(p.approval_count, 1, "proposer's approval is recorded");
    assert_eq!(p.rejection_count, 0);
    assert!(!p.is_executed);
    assert!(!p.is_rejected);
    assert!(f.client().has_approved(&id, &f.signers[0]));
}

#[test]
fn approve_increments_count() {
    let f = Fixture::new();
    let to = Address::generate(&f.env);
    let id = f.approved_transfer(&to, 1_000);
    assert_eq!(f.client().get_proposal(&id).approval_count, 2);
    assert!(f.client().has_approved(&id, &f.signers[1]));
}

#[test]
fn double_approve_fails() {
    let f = Fixture::new();
    let to = Address::generate(&f.env);
    let id = f.approved_transfer(&to, 1_000);
    assert_eq!(
        f.client().try_approve(&f.signers[1], &id),
        Err(Ok(VaultError::AlreadyApproved))
    );
}

#[test]
fn reject_flips_proposal_at_threshold() {
    let f = Fixture::new();
    let to = Address::generate(&f.env);
    let id = f.client().propose(
        &f.signers[0],
        &ProposalType::Transfer,
        &f.token,
        &to,
        &1_000i128,
        &0u64, &0u64, &0u64, &0u64, &false,
        &Symbol::new(&f.env, "t"),
    );

    f.client().reject(&f.signers[1], &id);
    assert_eq!(f.client().get_proposal(&id).rejection_count, 1);
    assert!(!f.client().get_proposal(&id).is_rejected, "one rejection is below threshold 2");

    f.client().reject(&f.signers[2], &id);
    let p = f.client().get_proposal(&id);
    assert_eq!(p.rejection_count, 2);
    assert!(p.is_rejected, "threshold rejections mark the proposal rejected");
    assert!(f.client().has_rejected(&id, &f.signers[2]));
}

#[test]
fn rejected_proposal_cannot_be_executed() {
    let f = Fixture::new();
    let to = Address::generate(&f.env);
    let id = f.approved_transfer(&to, 1_000);
    f.client().reject(&f.signers[1], &id);
    f.client().reject(&f.signers[2], &id);
    assert_eq!(
        f.client().try_execute(&f.signers[0], &id),
        Err(Ok(VaultError::AlreadyRejected))
    );
}

#[test]
fn execute_below_threshold_fails() {
    let f = Fixture::new();
    let to = Address::generate(&f.env);
    let id = f.client().propose(
        &f.signers[0],
        &ProposalType::Transfer,
        &f.token,
        &to,
        &1_000i128,
        &0u64, &0u64, &0u64, &0u64, &false,
        &Symbol::new(&f.env, "t"),
    );
    // Only the proposer has approved: 1 of 2.
    assert_eq!(
        f.client().try_execute(&f.signers[0], &id),
        Err(Ok(VaultError::NotEnoughApprovals))
    );
}

#[test]
fn execute_twice_fails() {
    let f = Fixture::new();
    let to = Address::generate(&f.env);
    let id = f.approved_transfer(&to, 1_000);
    f.client().execute(&f.signers[0], &id);
    assert_eq!(
        f.client().try_execute(&f.signers[0], &id),
        Err(Ok(VaultError::AlreadyExecuted))
    );
}

#[test]
fn non_signer_cannot_propose() {
    let f = Fixture::new();
    let outsider = Address::generate(&f.env);
    let to = Address::generate(&f.env);
    assert_eq!(
        f.client().try_propose(
            &outsider,
            &ProposalType::Transfer,
            &f.token,
            &to,
            &1_000i128,
            &0u64, &0u64, &0u64, &0u64, &false,
            &Symbol::new(&f.env, "t"),
        ),
        Err(Ok(VaultError::NotSigner))
    );
}

#[test]
fn propose_rejects_non_positive_amount() {
    let f = Fixture::new();
    let to = Address::generate(&f.env);
    assert_eq!(
        f.client().try_propose(
            &f.signers[0],
            &ProposalType::Transfer,
            &f.token,
            &to,
            &0i128,
            &0u64, &0u64, &0u64, &0u64, &false,
            &Symbol::new(&f.env, "t"),
        ),
        Err(Ok(VaultError::InvalidAmount))
    );
}

// ============================================================================
// PAYLOAD BINDING
//
// Regression tests for the vulnerability where execute() accepted the
// operation as caller-supplied arguments. Approvals authorized a
// ProposalType, not a transaction.
// ============================================================================

#[test]
fn proposal_payload_is_persisted_exactly_as_proposed() {
    let f = Fixture::new();
    let alice = Address::generate(&f.env);
    let id = f.approved_transfer(&alice, 12_345);

    let payload = f.client().get_proposal_payload(&id);
    assert_eq!(payload.token, f.token);
    assert_eq!(payload.recipient, alice);
    assert_eq!(payload.amount, 12_345);
}

#[test]
fn execute_pays_the_approved_recipient_only() {
    let f = Fixture::new();
    let alice = Address::generate(&f.env);
    let attacker = Address::generate(&f.env);

    let id = f.approved_transfer(&alice, 5_000);
    f.client().execute(&f.signers[0], &id);

    assert_eq!(f.balance(&alice), 5_000, "approved recipient is paid");
    assert_eq!(f.balance(&attacker), 0, "nobody else is");
    assert_eq!(f.balance(&f.vault), VAULT_FUNDS - 5_000);
}

#[test]
fn set_role_executes_the_approved_role_not_an_escalated_one() {
    let f = Fixture::new();
    // Propose making signers[2] an Admin (amount 1 => Role::Admin).
    let id = f.client().propose(
        &f.signers[0],
        &ProposalType::SetRole,
        &f.token,
        &f.signers[2],
        &1i128,
        &0u64, &0u64, &0u64, &0u64, &false,
        &Symbol::new(&f.env, "role"),
    );
    f.client().approve(&f.signers[1], &id);
    f.client().execute(&f.signers[0], &id);

    assert_eq!(
        f.client().get_role(&f.signers[2]),
        Role::Admin,
        "the approved role is applied, and cannot be swapped for SuperAdmin at execute time"
    );
}

// ============================================================================
// LOCKED VS SPENDABLE BALANCE
//
// The invariant the product is built on: funds committed to a beneficiary
// cannot be spent by a later proposal, even one that reaches threshold.
// ============================================================================

#[test]
fn locked_total_starts_at_zero_and_available_equals_balance() {
    let f = Fixture::new();
    assert_eq!(f.client().get_token_locked(&f.token), 0);
    assert_eq!(f.client().get_available_balance(&f.token), VAULT_FUNDS);
}

#[test]
fn executing_a_lock_segregates_the_committed_amount() {
    let f = Fixture::new();
    let beneficiary = Address::generate(&f.env);

    let id = f.approved_timelock(&beneficiary, 400_000_000, 10_000);
    f.client().execute(&f.signers[0], &id);

    assert_eq!(f.client().get_token_locked(&f.token), 400_000_000);
    assert_eq!(
        f.client().get_available_balance(&f.token),
        VAULT_FUNDS - 400_000_000,
        "locked funds are excluded from available balance"
    );
    // The tokens have not left the vault, they are merely committed.
    assert_eq!(f.balance(&f.vault), VAULT_FUNDS);
}

#[test]
fn propose_cannot_exceed_available_balance() {
    let f = Fixture::new();
    let beneficiary = Address::generate(&f.env);
    let to = Address::generate(&f.env);

    let lock = f.approved_timelock(&beneficiary, 900_000_000, 10_000);
    f.client().execute(&f.signers[0], &lock);

    // 100_000_000 remains available; asking for more must fail at propose time.
    assert_eq!(
        f.client().try_propose(
            &f.signers[0],
            &ProposalType::Transfer,
            &f.token,
            &to,
            &200_000_000i128,
            &0u64, &0u64, &0u64, &0u64, &false,
            &Symbol::new(&f.env, "t"),
        ),
        Err(Ok(VaultError::InsufficientBalance))
    );
}

/// The regression test that matters most.
///
/// Both proposals are valid when raised, because neither is executed yet.
/// Executing the lock first commits the funds. The transfer has already met
/// threshold — and must still fail, because approval does not override a
/// prior commitment.
#[test]
fn threshold_approval_cannot_spend_funds_committed_after_proposing() {
    let f = Fixture::new();
    let beneficiary = Address::generate(&f.env);
    let to = Address::generate(&f.env);

    // Available is VAULT_FUNDS at this point, so both pass propose-time checks.
    let transfer = f.approved_transfer(&to, 600_000_000);
    let lock = f.approved_timelock(&beneficiary, 700_000_000, 10_000);

    // Commit 700M to the beneficiary. Available drops to 300M.
    f.client().execute(&f.signers[0], &lock);
    assert_eq!(f.client().get_token_locked(&f.token), 700_000_000);

    // The transfer has 2 of 2 approvals. It must still be refused.
    assert_eq!(
        f.client().try_execute(&f.signers[0], &transfer),
        Err(Ok(VaultError::InsufficientBalance)),
        "committed funds survive a threshold-approved transfer"
    );

    // The beneficiary's entitlement is intact.
    assert_eq!(f.balance(&to), 0);
    assert!(f.balance(&f.vault) >= f.client().get_token_locked(&f.token));
}

#[test]
fn two_locks_cannot_double_commit_the_same_balance() {
    let f = Fixture::new();
    let b1 = Address::generate(&f.env);
    let b2 = Address::generate(&f.env);

    let lock1 = f.approved_timelock(&b1, 600_000_000, 10_000);
    let lock2 = f.approved_timelock(&b2, 600_000_000, 10_000);

    f.client().execute(&f.signers[0], &lock1);
    assert_eq!(
        f.client().try_execute(&f.signers[0], &lock2),
        Err(Ok(VaultError::InsufficientBalance)),
        "1.2B cannot be committed out of a 1B balance"
    );
}

// ============================================================================
// CLAIMING
// ============================================================================

#[test]
fn beneficiary_cannot_claim_before_unlock() {
    let f = Fixture::new();
    let beneficiary = Address::generate(&f.env);

    let id = f.approved_timelock(&beneficiary, 100_000_000, 10_000);
    f.client().execute(&f.signers[0], &id);

    f.env.ledger().set_timestamp(5_000); // before end_time
    assert_eq!(
        f.client().try_claim_lock(&beneficiary, &1u64),
        Err(Ok(VaultError::NothingToRelease))
    );
}

#[test]
fn beneficiary_claims_after_unlock_and_locked_total_drops() {
    let f = Fixture::new();
    let beneficiary = Address::generate(&f.env);
    f.fund(&beneficiary, SIGNER_FUNDS); // claim_lock charges the caller a fee

    let id = f.approved_timelock(&beneficiary, 100_000_000, 10_000);
    f.client().execute(&f.signers[0], &id);

    f.env.ledger().set_timestamp(20_000); // past end_time
    let claimed = f.client().claim_lock(&beneficiary, &1u64);

    assert_eq!(claimed, 100_000_000);
    assert_eq!(f.client().get_token_locked(&f.token), 0, "commitment released");
}

#[test]
fn non_beneficiary_cannot_claim() {
    let f = Fixture::new();
    let beneficiary = Address::generate(&f.env);
    let stranger = Address::generate(&f.env);

    let id = f.approved_timelock(&beneficiary, 100_000_000, 10_000);
    f.client().execute(&f.signers[0], &id);
    f.env.ledger().set_timestamp(20_000);

    assert_eq!(
        f.client().try_claim_lock(&stranger, &1u64),
        Err(Ok(VaultError::NotAuthorized))
    );
}

// ============================================================================
// ROLES
// ============================================================================

#[test]
fn executor_cannot_change_roles_directly() {
    let f = Fixture::new();
    // signers[1] is an Executor; set_role requires Admin or higher.
    assert_eq!(
        f.client().try_set_role(&f.signers[1], &f.signers[2], &Role::Admin),
        Err(Ok(VaultError::NotAuthorized))
    );
}

#[test]
fn super_admin_can_change_roles() {
    let f = Fixture::new();
    f.client().set_role(&f.signers[0], &f.signers[1], &Role::Admin);
    assert_eq!(f.client().get_role(&f.signers[1]), Role::Admin);
}

#[test]
fn threshold_cannot_exceed_signer_count() {
    let f = Fixture::new();
    assert_eq!(
        f.client().try_set_threshold(&f.signers[0], &99u32),
        Err(Ok(VaultError::InvalidThreshold))
    );
}

// ============================================================================
// SIGNER SET INTEGRITY
// ============================================================================

/// Regression test. Leaving as the sole signer used to empty the signer set,
/// after which nothing could ever be proposed, approved or executed again and
/// any uncommitted balance was unrecoverable.
#[test]
fn last_signer_cannot_leave_and_brick_the_vault() {
    let env = Env::default();
    env.mock_all_auths();

    let vault = env.register(StellarVault, ());
    let token_admin = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(token_admin).address();
    let solo = Address::generate(&env);
    token::StellarAssetClient::new(&env, &token).mint(&solo, &SIGNER_FUNDS);

    let client = StellarVaultClient::new(&env, &vault);
    client.initialize(
        &Symbol::new(&env, "Solo"),
        &soroban_sdk::vec![&env, solo.clone()],
        &1u32,
        &solo,
        &token,
    );

    assert_eq!(
        client.try_leave_vault(&solo),
        Err(Ok(VaultError::CannotLeaveAsLastSigner))
    );
    // The vault is still operable.
    assert_eq!(client.get_signers().len(), 1);
    assert_eq!(client.get_config().signer_count, 1);
}

#[test]
fn signer_cannot_leave_below_threshold() {
    let f = Fixture::new();
    // 3 signers, threshold 2. One may leave (3 -> 2); a second may not (2 -> 1).
    f.client().leave_vault(&f.signers[2]);
    assert_eq!(f.client().get_config().signer_count, 2);

    assert_eq!(
        f.client().try_leave_vault(&f.signers[1]),
        Err(Ok(VaultError::InvalidThreshold))
    );
}

#[test]
fn last_super_admin_cannot_leave() {
    let f = Fixture::new();
    assert_eq!(
        f.client().try_leave_vault(&f.signers[0]),
        Err(Ok(VaultError::CannotRemoveLastSuperAdmin))
    );
}

#[test]
fn removing_a_signer_below_threshold_is_refused() {
    let f = Fixture::new();
    f.client().remove_signer(&f.signers[0], &f.signers[2]);
    assert_eq!(f.client().get_config().signer_count, 2);

    // 2 signers with threshold 2 — removing another would strand the vault.
    assert_eq!(
        f.client().try_remove_signer(&f.signers[0], &f.signers[1]),
        Err(Ok(VaultError::InvalidThreshold))
    );
}

// ============================================================================
// LOCK CANCELLATION
//
// Revoking a lock requires the same signing threshold as moving funds. There is
// no unilateral cancel entry point.
// ============================================================================

impl Fixture {
    /// Proposes cancellation of `lock_id` and approves it to threshold.
    fn approved_cancel(&self, lock_id: u64) -> u64 {
        let id = self.client().propose(
            &self.signers[0],
            &ProposalType::CancelLock,
            &self.token,
            &self.signers[0], // recipient unused for CancelLock
            &(lock_id as i128),
            &0u64, &0u64, &0u64, &0u64, &false,
            &Symbol::new(&self.env, "cancel"),
        );
        self.client().approve(&self.signers[1], &id);
        id
    }

    /// Creates and executes a revocable time-lock, returning its lock id.
    fn active_lock(&self, beneficiary: &Address, amount: i128) -> u64 {
        let id = self.approved_timelock(beneficiary, amount, 10_000);
        self.client().execute(&self.signers[0], &id)
    }
}

#[test]
fn there_is_no_unilateral_cancel_entry_point() {
    let f = Fixture::new();
    let beneficiary = Address::generate(&f.env);
    let lock = f.active_lock(&beneficiary, 100_000_000);
    assert_eq!(lock, 1);

    // Cancellation must go through propose → approve → execute. A single
    // proposal without a second approval cannot free the funds.
    let id = f.client().propose(
        &f.signers[0],
        &ProposalType::CancelLock,
        &f.token,
        &f.signers[0],
        &1i128,
        &0u64, &0u64, &0u64, &0u64, &false,
        &Symbol::new(&f.env, "cancel"),
    );
    assert_eq!(
        f.client().try_execute(&f.signers[0], &id),
        Err(Ok(VaultError::NotEnoughApprovals)),
        "one Admin cannot revoke a commitment alone"
    );
    assert_eq!(f.client().get_token_locked(&f.token), 100_000_000);
}

#[test]
fn threshold_approved_cancel_releases_the_commitment() {
    let f = Fixture::new();
    let beneficiary = Address::generate(&f.env);
    f.active_lock(&beneficiary, 100_000_000);

    let cancel = f.approved_cancel(1);
    f.client().execute(&f.signers[0], &cancel);

    assert_eq!(f.client().get_token_locked(&f.token), 0, "commitment released");
    assert_eq!(f.client().get_available_balance(&f.token), VAULT_FUNDS);
}

#[test]
fn irrevocable_lock_cannot_be_cancelled() {
    let f = Fixture::new();
    let beneficiary = Address::generate(&f.env);

    let id = f.client().propose(
        &f.signers[0],
        &ProposalType::TimeLock,
        &f.token,
        &beneficiary,
        &100_000_000i128,
        &0u64, &10_000u64, &0u64, &1u64,
        &false, // not revocable
        &Symbol::new(&f.env, "lock"),
    );
    f.client().approve(&f.signers[1], &id);
    f.client().execute(&f.signers[0], &id);

    // Rejected at propose time, before signers spend fees on it.
    assert_eq!(
        f.client().try_propose(
            &f.signers[0],
            &ProposalType::CancelLock,
            &f.token,
            &f.signers[0],
            &1i128,
            &0u64, &0u64, &0u64, &0u64, &false,
            &Symbol::new(&f.env, "cancel"),
        ),
        Err(Ok(VaultError::LockNotRevocable)),
        "an irrevocable commitment is final"
    );
    assert_eq!(f.client().get_token_locked(&f.token), 100_000_000);
}

#[test]
fn cancelling_an_unknown_lock_is_refused_at_propose() {
    let f = Fixture::new();
    assert_eq!(
        f.client().try_propose(
            &f.signers[0],
            &ProposalType::CancelLock,
            &f.token,
            &f.signers[0],
            &999i128,
            &0u64, &0u64, &0u64, &0u64, &false,
            &Symbol::new(&f.env, "cancel"),
        ),
        Err(Ok(VaultError::LockNotFound))
    );
}

#[test]
fn cancelled_lock_cannot_be_claimed() {
    let f = Fixture::new();
    let beneficiary = Address::generate(&f.env);
    f.fund(&beneficiary, SIGNER_FUNDS);

    f.active_lock(&beneficiary, 100_000_000);
    let cancel = f.approved_cancel(1);
    f.client().execute(&f.signers[0], &cancel);

    f.env.ledger().set_timestamp(20_000);
    assert_eq!(
        f.client().try_claim_lock(&beneficiary, &1u64),
        Err(Ok(VaultError::LockNotActive))
    );
}

// ============================================================================
// APPROVALS FROM REMOVED SIGNERS
// ============================================================================

/// Removing a signer must invalidate the approval they already gave. Otherwise
/// a compromised key keeps counting toward threshold after being revoked.
#[test]
fn approval_from_a_removed_signer_stops_counting() {
    let f = Fixture::new();
    let to = Address::generate(&f.env);

    // signers[0] proposes (auto-approve), signers[2] approves. 2 of 2 met.
    let id = f.client().propose(
        &f.signers[0],
        &ProposalType::Transfer,
        &f.token,
        &to,
        &5_000i128,
        &0u64, &0u64, &0u64, &0u64, &false,
        &Symbol::new(&f.env, "t"),
    );
    f.client().approve(&f.signers[2], &id);
    assert_eq!(f.client().get_effective_approvals(&id), 2);

    // Threshold must drop to 1 first, or removal is refused for stranding the vault.
    f.client().set_threshold(&f.signers[0], &1u32);
    f.client().remove_signer(&f.signers[0], &f.signers[2]);

    // The running tally still records both approvals...
    assert_eq!(f.client().get_proposal(&id).approval_count, 2);
    // ...but only the remaining signer's approval counts.
    assert_eq!(f.client().get_effective_approvals(&id), 1);
}

#[test]
fn removed_signer_approval_cannot_carry_a_proposal_to_threshold() {
    let f = Fixture::new();
    let to = Address::generate(&f.env);

    // signers[1] proposes and signers[2] approves: 2 of 2.
    let id = f.client().propose(
        &f.signers[1],
        &ProposalType::Transfer,
        &f.token,
        &to,
        &5_000i128,
        &0u64, &0u64, &0u64, &0u64, &false,
        &Symbol::new(&f.env, "t"),
    );
    f.client().approve(&f.signers[2], &id);

    // Remove signers[2]. Signer count 3 -> 2, still >= threshold 2, so allowed.
    f.client().remove_signer(&f.signers[0], &f.signers[2]);

    // Only signers[1]'s approval survives: 1 of 2.
    assert_eq!(f.client().get_effective_approvals(&id), 1);
    assert_eq!(
        f.client().try_execute(&f.signers[0], &id),
        Err(Ok(VaultError::NotEnoughApprovals)),
        "a revoked signer's approval must not reach threshold"
    );
    assert_eq!(f.balance(&to), 0);
}
