#![no_std]
#![allow(deprecated)]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, token,
    Address, Env, Symbol, Vec,
};

// ============ CONSTANTS ============
const DEFAULT_TX_FEE: i128 = 1_000_000; // 0.1 XLM

// ============ TYPES ============

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Role {
    SuperAdmin = 0,
    Admin = 1,
    Executor = 2,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ProposalType {
    Transfer = 0,
    TimeLock = 1,
    VestingLock = 2,
    AddSigner = 3,
    RemoveSigner = 4,
    SetRole = 5,
    SetThreshold = 6,
    /// Revoke a lock created with `revocable = true`. The lock id travels in the
    /// payload's `amount` field, matching how AddSigner/SetRole/SetThreshold
    /// already encode their operand.
    CancelLock = 7,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum LockType {
    TimeLock = 0,
    Vesting = 1,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct VaultConfig {
    pub name: Symbol,
    pub threshold: u32,
    pub signer_count: u32,
    pub proposal_count: u64,
    pub lock_count: u64,
    pub fee_amount: i128,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct LockCore {
    pub beneficiary: Address,
    pub token: Address,
    pub total_amount: i128,
    pub released_amount: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub cliff_time: u64,
    pub release_intervals: u64,
    pub lock_type: LockType,
    pub revocable: bool,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct ProposalCore {
    pub proposal_type: ProposalType,
    pub approval_count: u32,
    pub rejection_count: u32,
    pub is_executed: bool,
    pub is_rejected: bool,
}

/// The operation a proposal authorizes.
///
/// Persisted at propose() time and read back at execute() time. Signers approve
/// *this*, not merely a ProposalType — without it, an approved "transfer 100 to
/// Alice" could be executed as "transfer everything to Bob".
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalPayload {
    pub token: Address,
    pub recipient: Address,
    pub amount: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub cliff_time: u64,
    pub release_intervals: u64,
    pub revocable: bool,
}

#[contracttype]
pub enum StorageKey {
    Config,
    Signers,
    SignerRole(Address),
    Proposal(u64),
    ProposalPayload(u64),
    ProposalApproval(u64, Address),
    ProposalRejection(u64, Address),
    Lock(u64),
    TokenLocked(Address),
    Initialized,
    FeeRecipient,
    FeeToken,
}

// ============ ERRORS ============

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VaultError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NotAuthorized = 3,
    NotSigner = 4,
    InvalidThreshold = 5,
    ProposalNotFound = 6,
    AlreadyApproved = 7,
    NotEnoughApprovals = 8,
    AlreadyExecuted = 9,
    InvalidAmount = 11,
    SignerAlreadyExists = 13,
    CannotRemoveLastSuperAdmin = 14,
    LockNotFound = 18,
    LockNotActive = 19,
    NothingToRelease = 20,
    LockNotRevocable = 22,
    InvalidTimeRange = 23,
    InsufficientBalance = 24,
    AlreadyRejected = 26,
    CannotLeaveAsLastSigner = 27,
}

// ============ CONTRACT ============

#[contract]
pub struct StellarVault;

#[contractimpl]
impl StellarVault {

    // ========================================================================
    // INITIALIZATION - now receives fee_recipient and fee_token as params
    // ========================================================================

    pub fn initialize(
        env: Env,
        name: Symbol,
        signers: Vec<Address>,
        threshold: u32,
        fee_recipient: Address,
        fee_token: Address,
    ) -> Result<(), VaultError> {
        if env.storage().instance().has(&StorageKey::Initialized) {
            return Err(VaultError::AlreadyInitialized);
        }

        if signers.is_empty() || threshold == 0 || threshold > signers.len() as u32 {
            return Err(VaultError::InvalidThreshold);
        }

        let config = VaultConfig {
            name: name.clone(),
            threshold,
            signer_count: signers.len() as u32,
            proposal_count: 0,
            lock_count: 0,
            fee_amount: DEFAULT_TX_FEE,
        };

        env.storage().instance().set(&StorageKey::Config, &config);
        env.storage().instance().set(&StorageKey::Signers, &signers);
        env.storage().instance().set(&StorageKey::FeeRecipient, &fee_recipient);
        env.storage().instance().set(&StorageKey::FeeToken, &fee_token);

        // First signer is SuperAdmin, rest are Executors
        for (i, signer) in signers.iter().enumerate() {
            let role = if i == 0 { Role::SuperAdmin } else { Role::Executor };
            env.storage().instance().set(&StorageKey::SignerRole(signer.clone()), &role);
        }

        env.storage().instance().set(&StorageKey::Initialized, &true);

        env.events().publish(
            (Symbol::new(&env, "vault_initialized"),),
            (env.current_contract_address(), name, threshold, signers),
        );

        Ok(())
    }

    // ========================================================================
    // Everything below stays exactly the same
    // ========================================================================

    fn collect_fee(env: &Env, payer: &Address) -> Result<(), VaultError> {
        let config: VaultConfig = env.storage().instance().get(&StorageKey::Config).unwrap();
        let fee_recipient: Address = env.storage().instance().get(&StorageKey::FeeRecipient).unwrap();
        let fee_token: Address = env.storage().instance().get(&StorageKey::FeeToken).unwrap();

        if config.fee_amount > 0 {
            let token_client = token::Client::new(env, &fee_token);
            token_client.transfer(payer, &fee_recipient, &config.fee_amount);
        }
        Ok(())
    }

    fn require_initialized(env: &Env) -> Result<(), VaultError> {
        if !env.storage().instance().has(&StorageKey::Initialized) {
            return Err(VaultError::NotInitialized);
        }
        Ok(())
    }

    fn require_signer(env: &Env, address: &Address) -> Result<(), VaultError> {
        let signers: Vec<Address> = env.storage().instance().get(&StorageKey::Signers).unwrap();
        if !signers.contains(address) {
            return Err(VaultError::NotSigner);
        }
        Ok(())
    }

    fn get_role_internal(env: &Env, address: &Address) -> Role {
        env.storage().instance()
            .get(&StorageKey::SignerRole(address.clone()))
            .unwrap_or(Role::Executor)
    }

    fn is_super_admin(env: &Env, address: &Address) -> bool {
        Self::require_signer(env, address).is_ok() && Self::get_role_internal(env, address) == Role::SuperAdmin
    }

    fn require_role(env: &Env, address: &Address, max_role: Role) -> Result<(), VaultError> {
        Self::require_signer(env, address)?;
        let role = Self::get_role_internal(env, address);
        // Lower number = higher privilege, so role must be <= max_role
        if role as u32 > max_role as u32 {
            return Err(VaultError::NotAuthorized);
        }
        Ok(())
    }

    fn count_super_admins(env: &Env) -> u32 {
        let signers: Vec<Address> = env.storage().instance().get(&StorageKey::Signers).unwrap();
        let mut count = 0u32;
        for s in signers.iter() {
            if Self::get_role_internal(env, &s) == Role::SuperAdmin {
                count += 1;
            }
        }
        count
    }

    pub fn add_signer(env: Env, caller: Address, new_signer: Address, role: Role) -> Result<(), VaultError> {
        caller.require_auth();
        Self::require_initialized(&env)?;
        if !Self::is_super_admin(&env, &caller) {
            return Err(VaultError::NotAuthorized);
        }
        let mut signers: Vec<Address> = env.storage().instance().get(&StorageKey::Signers).unwrap();
        if signers.contains(&new_signer) {
            return Err(VaultError::SignerAlreadyExists);
        }
        Self::collect_fee(&env, &caller)?;
        signers.push_back(new_signer.clone());
        let mut config: VaultConfig = env.storage().instance().get(&StorageKey::Config).unwrap();
        config.signer_count = signers.len() as u32;
        env.storage().instance().set(&StorageKey::Signers, &signers);
        env.storage().instance().set(&StorageKey::Config, &config);
        env.storage().instance().set(&StorageKey::SignerRole(new_signer.clone()), &role);
        env.events().publish((Symbol::new(&env, "signer_added"),), (new_signer, role as u32));
        Ok(())
    }

    pub fn remove_signer(env: Env, caller: Address, signer: Address) -> Result<(), VaultError> {
        caller.require_auth();
        Self::require_initialized(&env)?;
        if !Self::is_super_admin(&env, &caller) {
            return Err(VaultError::NotAuthorized);
        }
        Self::require_signer(&env, &signer)?;
        let role = Self::get_role_internal(&env, &signer);
        if role == Role::SuperAdmin && Self::count_super_admins(&env) <= 1 {
            return Err(VaultError::CannotRemoveLastSuperAdmin);
        }
        let mut config: VaultConfig = env.storage().instance().get(&StorageKey::Config).unwrap();
        if config.signer_count <= config.threshold {
            return Err(VaultError::InvalidThreshold);
        }
        Self::collect_fee(&env, &caller)?;
        let signers: Vec<Address> = env.storage().instance().get(&StorageKey::Signers).unwrap();
        let mut new_signers = Vec::new(&env);
        for s in signers.iter() {
            if s != signer { new_signers.push_back(s); }
        }
        config.signer_count = new_signers.len() as u32;
        env.storage().instance().set(&StorageKey::Signers, &new_signers);
        env.storage().instance().set(&StorageKey::Config, &config);
        env.storage().instance().remove(&StorageKey::SignerRole(signer.clone()));
        env.events().publish((Symbol::new(&env, "signer_removed"),), signer);
        Ok(())
    }

    pub fn set_role(env: Env, caller: Address, signer: Address, new_role: Role) -> Result<(), VaultError> {
        caller.require_auth();
        Self::require_initialized(&env)?;
        if !Self::is_super_admin(&env, &caller) {
            return Err(VaultError::NotAuthorized);
        }
        Self::require_signer(&env, &signer)?;
        let current_role = Self::get_role_internal(&env, &signer);
        if current_role == Role::SuperAdmin && new_role != Role::SuperAdmin {
            if Self::count_super_admins(&env) <= 1 {
                return Err(VaultError::CannotRemoveLastSuperAdmin);
            }
        }
        Self::collect_fee(&env, &caller)?;
        env.storage().instance().set(&StorageKey::SignerRole(signer.clone()), &new_role);
        env.events().publish((Symbol::new(&env, "role_changed"),), (signer, new_role as u32));
        Ok(())
    }

    pub fn set_threshold(env: Env, caller: Address, new_threshold: u32) -> Result<(), VaultError> {
        caller.require_auth();
        Self::require_initialized(&env)?;
        if !Self::is_super_admin(&env, &caller) {
            return Err(VaultError::NotAuthorized);
        }
        let mut config: VaultConfig = env.storage().instance().get(&StorageKey::Config).unwrap();
        if new_threshold == 0 || new_threshold > config.signer_count {
            return Err(VaultError::InvalidThreshold);
        }
        Self::collect_fee(&env, &caller)?;
        config.threshold = new_threshold;
        env.storage().instance().set(&StorageKey::Config, &config);
        env.events().publish((Symbol::new(&env, "threshold_changed"),), new_threshold);
        Ok(())
    }

    pub fn leave_vault(env: Env, signer: Address) -> Result<(), VaultError> {
        signer.require_auth();
        Self::require_initialized(&env)?;
        Self::require_signer(&env, &signer)?;
        let mut config: VaultConfig = env.storage().instance().get(&StorageKey::Config).unwrap();
        let signers: Vec<Address> = env.storage().instance().get(&StorageKey::Signers).unwrap();
        // Leaving as the sole signer used to be permitted, which emptied the
        // signer set and permanently bricked the vault: with no signers, nothing
        // can be proposed, approved or executed ever again, and add_signer needs
        // a SuperAdmin who no longer exists. Any balance not already committed to
        // a lock became unrecoverable. Add a second signer before leaving.
        if signers.len() == 1 {
            return Err(VaultError::CannotLeaveAsLastSigner);
        }
        let role = Self::get_role_internal(&env, &signer);
        if role == Role::SuperAdmin && Self::count_super_admins(&env) <= 1 {
            return Err(VaultError::CannotRemoveLastSuperAdmin);
        }
        if config.signer_count <= config.threshold {
            return Err(VaultError::InvalidThreshold);
        }
        Self::collect_fee(&env, &signer)?;
        let mut new_signers = Vec::new(&env);
        for s in signers.iter() {
            if s != signer { new_signers.push_back(s); }
        }
        config.signer_count = new_signers.len() as u32;
        env.storage().instance().set(&StorageKey::Signers, &new_signers);
        env.storage().instance().set(&StorageKey::Config, &config);
        env.storage().instance().remove(&StorageKey::SignerRole(signer.clone()));
        env.events().publish((Symbol::new(&env, "signer_left"),), signer);
        Ok(())
    }

    pub fn propose(
        env: Env,
        proposer: Address,
        proposal_type: ProposalType,
        token: Address,
        recipient: Address,
        amount: i128,
        start_time: u64,
        end_time: u64,
        cliff_time: u64,
        release_intervals: u64,
        revocable: bool,
        description: Symbol,
    ) -> Result<u64, VaultError> {
        proposer.require_auth();
        Self::require_initialized(&env)?;
        Self::require_role(&env, &proposer, Role::Executor)?;
        if amount <= 0 && (proposal_type == ProposalType::Transfer ||
                          proposal_type == ProposalType::TimeLock ||
                          proposal_type == ProposalType::VestingLock) {
            return Err(VaultError::InvalidAmount);
        }
        if proposal_type == ProposalType::Transfer ||
           proposal_type == ProposalType::TimeLock ||
           proposal_type == ProposalType::VestingLock {
            let token_client = token::Client::new(&env, &token);
            let balance = token_client.balance(&env.current_contract_address());
            let locked: i128 = env.storage().instance()
                .get(&StorageKey::TokenLocked(token.clone()))
                .unwrap_or(0);
            if balance - locked < amount {
                return Err(VaultError::InsufficientBalance);
            }
        }
        // Fail a cancellation early rather than after signers have spent fees
        // approving something that can never execute.
        if proposal_type == ProposalType::CancelLock {
            if amount < 1 {
                return Err(VaultError::LockNotFound);
            }
            let lock: LockCore = env.storage().instance()
                .get(&StorageKey::Lock(amount as u64))
                .ok_or(VaultError::LockNotFound)?;
            if !lock.is_active {
                return Err(VaultError::LockNotActive);
            }
            if !lock.revocable {
                return Err(VaultError::LockNotRevocable);
            }
        }
        Self::collect_fee(&env, &proposer)?;
        let mut config: VaultConfig = env.storage().instance().get(&StorageKey::Config).unwrap();
        config.proposal_count += 1;
        let proposal_id = config.proposal_count;
        let proposal = ProposalCore {
            proposal_type,
            approval_count: 1,
            rejection_count: 0,
            is_executed: false,
            is_rejected: false,
        };
        // The payload is persisted, not just emitted. execute() reads it back
        // rather than trusting arguments, so approvals bind to this exact
        // operation.
        let payload = ProposalPayload {
            token: token.clone(),
            recipient: recipient.clone(),
            amount,
            start_time,
            end_time,
            cliff_time,
            release_intervals,
            revocable,
        };
        env.storage().instance().set(&StorageKey::Proposal(proposal_id), &proposal);
        env.storage().instance().set(&StorageKey::ProposalPayload(proposal_id), &payload);
        env.storage().instance().set(&StorageKey::ProposalApproval(proposal_id, proposer.clone()), &true);
        env.storage().instance().set(&StorageKey::Config, &config);
        env.events().publish(
            (Symbol::new(&env, "proposal_created"),),
            (proposal_id, proposer, proposal_type as u32, token, recipient, amount,
             start_time, end_time, cliff_time, release_intervals, revocable, description),
        );
        Ok(proposal_id)
    }

    pub fn approve(env: Env, signer: Address, proposal_id: u64) -> Result<(), VaultError> {
        signer.require_auth();
        Self::require_initialized(&env)?;
        Self::require_role(&env, &signer, Role::Executor)?;
        let mut proposal: ProposalCore = env.storage().instance()
            .get(&StorageKey::Proposal(proposal_id))
            .ok_or(VaultError::ProposalNotFound)?;
        if proposal.is_executed || proposal.is_rejected {
            return Err(VaultError::AlreadyExecuted);
        }
        if env.storage().instance().has(&StorageKey::ProposalApproval(proposal_id, signer.clone())) {
            return Err(VaultError::AlreadyApproved);
        }
        Self::collect_fee(&env, &signer)?;
        proposal.approval_count += 1;
        env.storage().instance().set(&StorageKey::Proposal(proposal_id), &proposal);
        env.storage().instance().set(&StorageKey::ProposalApproval(proposal_id, signer.clone()), &true);
        env.events().publish((Symbol::new(&env, "proposal_approved"),), (proposal_id, signer, proposal.approval_count));
        Ok(())
    }

    pub fn reject(env: Env, signer: Address, proposal_id: u64) -> Result<(), VaultError> {
        signer.require_auth();
        Self::require_initialized(&env)?;
        Self::require_role(&env, &signer, Role::Executor)?;
        let mut proposal: ProposalCore = env.storage().instance()
            .get(&StorageKey::Proposal(proposal_id))
            .ok_or(VaultError::ProposalNotFound)?;
        if proposal.is_executed || proposal.is_rejected {
            return Err(VaultError::AlreadyExecuted);
        }
        if env.storage().instance().has(&StorageKey::ProposalRejection(proposal_id, signer.clone())) {
            return Err(VaultError::AlreadyApproved);
        }
        Self::collect_fee(&env, &signer)?;
        proposal.rejection_count += 1;
        let config: VaultConfig = env.storage().instance().get(&StorageKey::Config).unwrap();
        if proposal.rejection_count >= config.threshold {
            proposal.is_rejected = true;
        }
        env.storage().instance().set(&StorageKey::Proposal(proposal_id), &proposal);
        env.storage().instance().set(&StorageKey::ProposalRejection(proposal_id, signer.clone()), &true);
        env.events().publish((Symbol::new(&env, "proposal_rejected"),), (proposal_id, signer, proposal.rejection_count, proposal.is_rejected));
        Ok(())
    }

    /// Executes a proposal that has reached threshold.
    ///
    /// Takes only the proposal id. The operation to perform is read from
    /// storage, so what executes is exactly what the signers approved.
    pub fn execute(
        env: Env,
        executor: Address,
        proposal_id: u64,
    ) -> Result<u64, VaultError> {
        executor.require_auth();
        Self::require_initialized(&env)?;
        Self::require_role(&env, &executor, Role::Executor)?;
        let mut proposal: ProposalCore = env.storage().instance()
            .get(&StorageKey::Proposal(proposal_id))
            .ok_or(VaultError::ProposalNotFound)?;
        if proposal.is_executed {
            return Err(VaultError::AlreadyExecuted);
        }
        if proposal.is_rejected {
            return Err(VaultError::AlreadyRejected);
        }
        let config: VaultConfig = env.storage().instance().get(&StorageKey::Config).unwrap();
        // Count approvals from signers who are *currently* in the signer set,
        // rather than trusting the stored tally. A signer removed after
        // approving — say, because their key leaked — must stop counting toward
        // threshold. Iterating the signer set is bounded; iterating proposals to
        // purge stale approvals at removal time would not be.
        if Self::effective_approvals(&env, proposal_id) < config.threshold {
            return Err(VaultError::NotEnoughApprovals);
        }
        let payload: ProposalPayload = env.storage().instance()
            .get(&StorageKey::ProposalPayload(proposal_id))
            .ok_or(VaultError::ProposalNotFound)?;
        let proposal_type = proposal.proposal_type;
        let ProposalPayload {
            token, recipient, amount,
            start_time, end_time, cliff_time, release_intervals, revocable,
        } = payload;
        Self::collect_fee(&env, &executor)?;
        let result = match proposal_type {
            ProposalType::Transfer => {
                // Re-check at execution time. Balance and locked totals can both
                // have moved since the proposal was raised, and committed funds
                // must stay committed even for a proposal that met threshold.
                let token_client = token::Client::new(&env, &token);
                let balance = token_client.balance(&env.current_contract_address());
                let locked: i128 = env.storage().instance()
                    .get(&StorageKey::TokenLocked(token.clone()))
                    .unwrap_or(0);
                if balance - locked < amount {
                    return Err(VaultError::InsufficientBalance);
                }
                token_client.transfer(&env.current_contract_address(), &recipient, &amount);
                0u64
            }
            ProposalType::TimeLock | ProposalType::VestingLock => {
                // Same re-check: two locks proposed against the same balance
                // must not both succeed.
                let token_client = token::Client::new(&env, &token);
                let balance = token_client.balance(&env.current_contract_address());
                let locked: i128 = env.storage().instance()
                    .get(&StorageKey::TokenLocked(token.clone()))
                    .unwrap_or(0);
                if balance - locked < amount {
                    return Err(VaultError::InsufficientBalance);
                }
                Self::create_lock_internal(
                    &env, proposal_type, recipient.clone(), token.clone(), amount,
                    start_time, end_time, cliff_time, release_intervals, revocable,
                )?
            }
            ProposalType::AddSigner => {
                let role = match amount { 0 => Role::SuperAdmin, 1 => Role::Admin, _ => Role::Executor };
                Self::execute_add_signer_internal(&env, recipient.clone(), role)?;
                0u64
            }
            ProposalType::RemoveSigner => {
                Self::execute_remove_signer_internal(&env, recipient.clone())?;
                0u64
            }
            ProposalType::SetRole => {
                let role = match amount { 0 => Role::SuperAdmin, 1 => Role::Admin, _ => Role::Executor };
                Self::execute_set_role_internal(&env, recipient.clone(), role)?;
                0u64
            }
            ProposalType::SetThreshold => {
                Self::execute_set_threshold_internal(&env, amount as u32)?;
                0u64
            }
            ProposalType::CancelLock => {
                Self::cancel_lock_internal(&env, amount as u64, &executor)?;
                0u64
            }
        };
        proposal.is_executed = true;
        env.storage().instance().set(&StorageKey::Proposal(proposal_id), &proposal);
        env.events().publish((Symbol::new(&env, "proposal_executed"),), (proposal_id, executor, result));
        Ok(result)
    }

    fn create_lock_internal(
        env: &Env,
        proposal_type: ProposalType,
        beneficiary: Address,
        token: Address,
        amount: i128,
        start_time: u64,
        end_time: u64,
        cliff_time: u64,
        release_intervals: u64,
        revocable: bool,
    ) -> Result<u64, VaultError> {
        let mut config: VaultConfig = env.storage().instance().get(&StorageKey::Config).unwrap();
        config.lock_count += 1;
        let lock_id = config.lock_count;
        let lock_type = if proposal_type == ProposalType::TimeLock { LockType::TimeLock } else { LockType::Vesting };
        let lock = LockCore {
            beneficiary: beneficiary.clone(),
            token: token.clone(),
            total_amount: amount,
            released_amount: 0,
            start_time,
            end_time,
            cliff_time,
            release_intervals,
            lock_type,
            revocable,
            is_active: true,
        };
        let current_locked: i128 = env.storage().instance()
            .get(&StorageKey::TokenLocked(token.clone()))
            .unwrap_or(0);
        env.storage().instance().set(&StorageKey::TokenLocked(token.clone()), &(current_locked + amount));
        env.storage().instance().set(&StorageKey::Lock(lock_id), &lock);
        env.storage().instance().set(&StorageKey::Config, &config);
        env.events().publish(
            (Symbol::new(env, "lock_created"),),
            (lock_id, beneficiary, token, amount, lock_type as u32, start_time, end_time, cliff_time, release_intervals, revocable),
        );
        Ok(lock_id)
    }

    pub fn claim_lock(env: Env, caller: Address, lock_id: u64) -> Result<i128, VaultError> {
        caller.require_auth();
        Self::require_initialized(&env)?;
        let mut lock: LockCore = env.storage().instance()
            .get(&StorageKey::Lock(lock_id))
            .ok_or(VaultError::LockNotFound)?;
        if !lock.is_active {
            return Err(VaultError::LockNotActive);
        }
        let is_beneficiary = lock.beneficiary == caller;
        let is_admin = Self::require_role(&env, &caller, Role::Admin).is_ok();
        if !is_beneficiary && !is_admin {
            return Err(VaultError::NotAuthorized);
        }
        let current_time = env.ledger().timestamp();
        let available = Self::calculate_available(&lock, current_time);
        if available <= 0 {
            return Err(VaultError::NothingToRelease);
        }
        Self::collect_fee(&env, &caller)?;
        let token_client = token::Client::new(&env, &lock.token);
        token_client.transfer(&env.current_contract_address(), &lock.beneficiary, &available);
        lock.released_amount += available;
        if lock.released_amount >= lock.total_amount {
            lock.is_active = false;
        }
        let current_locked: i128 = env.storage().instance()
            .get(&StorageKey::TokenLocked(lock.token.clone()))
            .unwrap_or(0);
        env.storage().instance().set(&StorageKey::TokenLocked(lock.token.clone()), &(current_locked - available));
        env.storage().instance().set(&StorageKey::Lock(lock_id), &lock);
        env.events().publish(
            (Symbol::new(&env, "lock_claimed"),),
            (lock_id, caller, available, lock.released_amount, !lock.is_active),
        );
        Ok(available)
    }

    /// Revokes a lock. Reachable only through an executed `CancelLock` proposal,
    /// so revocation requires the same signing threshold as moving funds. It was
    /// previously a public entry point gated on `Role::Admin` alone, which let a
    /// single Admin free committed funds without any second approval.
    fn cancel_lock_internal(env: &Env, lock_id: u64, caller: &Address) -> Result<i128, VaultError> {
        let mut lock: LockCore = env.storage().instance()
            .get(&StorageKey::Lock(lock_id))
            .ok_or(VaultError::LockNotFound)?;
        if !lock.is_active {
            return Err(VaultError::LockNotActive);
        }
        if !lock.revocable {
            return Err(VaultError::LockNotRevocable);
        }
        let remaining = lock.total_amount - lock.released_amount;
        lock.released_amount = lock.total_amount;
        lock.is_active = false;
        let current_locked: i128 = env.storage().instance()
            .get(&StorageKey::TokenLocked(lock.token.clone()))
            .unwrap_or(0);
        env.storage().instance().set(&StorageKey::TokenLocked(lock.token.clone()), &(current_locked - remaining));
        env.storage().instance().set(&StorageKey::Lock(lock_id), &lock);
        env.events().publish(
            (Symbol::new(env, "lock_cancelled"),),
            (lock_id, caller.clone(), remaining),
        );
        Ok(remaining)
    }

    /// Approvals from signers currently in the signer set.
    ///
    /// `ProposalCore.approval_count` is a running tally of every approval ever
    /// recorded and is kept for display. This is the number that gates execution.
    fn effective_approvals(env: &Env, proposal_id: u64) -> u32 {
        let signers: Vec<Address> = env.storage().instance().get(&StorageKey::Signers).unwrap();
        let mut count = 0u32;
        for s in signers.iter() {
            if env.storage().instance().has(&StorageKey::ProposalApproval(proposal_id, s)) {
                count += 1;
            }
        }
        count
    }

    fn calculate_available(lock: &LockCore, current_time: u64) -> i128 {
        if !lock.is_active { return 0; }
        let remaining = lock.total_amount - lock.released_amount;
        match lock.lock_type {
            LockType::TimeLock => {
                if current_time >= lock.end_time { remaining } else { 0 }
            }
            LockType::Vesting => {
                if current_time < lock.cliff_time { return 0; }
                let vesting_duration = lock.end_time - lock.start_time;
                if vesting_duration == 0 { return remaining; }
                let elapsed = if current_time >= lock.end_time {
                    vesting_duration
                } else {
                    current_time - lock.start_time
                };
                let total_vested = if elapsed >= vesting_duration {
                    lock.total_amount
                } else if lock.release_intervals > 0 {
                    let intervals_passed = elapsed / lock.release_intervals;
                    let total_intervals = vesting_duration / lock.release_intervals;
                    if total_intervals > 0 {
                        (lock.total_amount * intervals_passed as i128) / total_intervals as i128
                    } else { 0 }
                } else {
                    (lock.total_amount * elapsed as i128) / vesting_duration as i128
                };
                let available = total_vested - lock.released_amount;
                if available > 0 { available } else { 0 }
            }
        }
    }

    fn execute_add_signer_internal(env: &Env, new_signer: Address, role: Role) -> Result<(), VaultError> {
        let mut signers: Vec<Address> = env.storage().instance().get(&StorageKey::Signers).unwrap();
        if signers.contains(&new_signer) {
            return Err(VaultError::SignerAlreadyExists);
        }
        signers.push_back(new_signer.clone());
        let mut config: VaultConfig = env.storage().instance().get(&StorageKey::Config).unwrap();
        config.signer_count = signers.len() as u32;
        env.storage().instance().set(&StorageKey::Signers, &signers);
        env.storage().instance().set(&StorageKey::Config, &config);
        env.storage().instance().set(&StorageKey::SignerRole(new_signer.clone()), &role);
        env.events().publish((Symbol::new(env, "signer_added"),), (new_signer, role as u32));
        Ok(())
    }

    fn execute_remove_signer_internal(env: &Env, signer: Address) -> Result<(), VaultError> {
        let role = Self::get_role_internal(env, &signer);
        if role == Role::SuperAdmin && Self::count_super_admins(env) <= 1 {
            return Err(VaultError::CannotRemoveLastSuperAdmin);
        }
        let mut config: VaultConfig = env.storage().instance().get(&StorageKey::Config).unwrap();
        if config.signer_count <= config.threshold {
            return Err(VaultError::InvalidThreshold);
        }
        let signers: Vec<Address> = env.storage().instance().get(&StorageKey::Signers).unwrap();
        let mut new_signers = Vec::new(env);
        for s in signers.iter() {
            if s != signer { new_signers.push_back(s); }
        }
        config.signer_count = new_signers.len() as u32;
        env.storage().instance().set(&StorageKey::Signers, &new_signers);
        env.storage().instance().set(&StorageKey::Config, &config);
        env.storage().instance().remove(&StorageKey::SignerRole(signer.clone()));
        env.events().publish((Symbol::new(env, "signer_removed"),), signer);
        Ok(())
    }

    fn execute_set_role_internal(env: &Env, signer: Address, new_role: Role) -> Result<(), VaultError> {
        let current_role = Self::get_role_internal(env, &signer);
        if current_role == Role::SuperAdmin && new_role != Role::SuperAdmin {
            if Self::count_super_admins(env) <= 1 {
                return Err(VaultError::CannotRemoveLastSuperAdmin);
            }
        }
        env.storage().instance().set(&StorageKey::SignerRole(signer.clone()), &new_role);
        env.events().publish((Symbol::new(env, "role_changed"),), (signer, new_role as u32));
        Ok(())
    }

    fn execute_set_threshold_internal(env: &Env, new_threshold: u32) -> Result<(), VaultError> {
        let mut config: VaultConfig = env.storage().instance().get(&StorageKey::Config).unwrap();
        if new_threshold == 0 || new_threshold > config.signer_count {
            return Err(VaultError::InvalidThreshold);
        }
        config.threshold = new_threshold;
        env.storage().instance().set(&StorageKey::Config, &config);
        env.events().publish((Symbol::new(env, "threshold_changed"),), new_threshold);
        Ok(())
    }

    pub fn get_config(env: Env) -> Result<VaultConfig, VaultError> {
        Self::require_initialized(&env)?;
        Ok(env.storage().instance().get(&StorageKey::Config).unwrap())
    }

    pub fn get_signers(env: Env) -> Result<Vec<Address>, VaultError> {
        Self::require_initialized(&env)?;
        Ok(env.storage().instance().get(&StorageKey::Signers).unwrap())
    }

    pub fn get_role(env: Env, signer: Address) -> Result<Role, VaultError> {
        Self::require_initialized(&env)?;
        Ok(Self::get_role_internal(&env, &signer))
    }

    pub fn get_proposal(env: Env, proposal_id: u64) -> Result<ProposalCore, VaultError> {
        Self::require_initialized(&env)?;
        env.storage().instance()
            .get(&StorageKey::Proposal(proposal_id))
            .ok_or(VaultError::ProposalNotFound)
    }

    /// Approvals that currently count toward threshold — i.e. those given by
    /// addresses still in the signer set. Differs from
    /// `ProposalCore.approval_count` whenever a signer has been removed since
    /// approving. This is the number execute() enforces against.
    pub fn get_effective_approvals(env: Env, proposal_id: u64) -> Result<u32, VaultError> {
        Self::require_initialized(&env)?;
        if !env.storage().instance().has(&StorageKey::Proposal(proposal_id)) {
            return Err(VaultError::ProposalNotFound);
        }
        Ok(Self::effective_approvals(&env, proposal_id))
    }

    /// The exact operation a proposal authorizes. Signers should read this
    /// before approving — it is what execute() will act on.
    pub fn get_proposal_payload(env: Env, proposal_id: u64) -> Result<ProposalPayload, VaultError> {
        Self::require_initialized(&env)?;
        env.storage().instance()
            .get(&StorageKey::ProposalPayload(proposal_id))
            .ok_or(VaultError::ProposalNotFound)
    }

    pub fn get_lock(env: Env, lock_id: u64) -> Result<LockCore, VaultError> {
        Self::require_initialized(&env)?;
        env.storage().instance()
            .get(&StorageKey::Lock(lock_id))
            .ok_or(VaultError::LockNotFound)
    }

    pub fn get_token_locked(env: Env, token: Address) -> Result<i128, VaultError> {
        Self::require_initialized(&env)?;
        Ok(env.storage().instance().get(&StorageKey::TokenLocked(token)).unwrap_or(0))
    }

    pub fn get_available_balance(env: Env, token: Address) -> Result<i128, VaultError> {
        Self::require_initialized(&env)?;
        let token_client = token::Client::new(&env, &token);
        let total = token_client.balance(&env.current_contract_address());
        let locked: i128 = env.storage().instance().get(&StorageKey::TokenLocked(token)).unwrap_or(0);
        Ok(total - locked)
    }

    pub fn has_approved(env: Env, proposal_id: u64, signer: Address) -> bool {
        env.storage().instance().has(&StorageKey::ProposalApproval(proposal_id, signer))
    }

    pub fn has_rejected(env: Env, proposal_id: u64, signer: Address) -> bool {
        env.storage().instance().has(&StorageKey::ProposalRejection(proposal_id, signer))
    }

    pub fn has_beneficiary(env: Env, address: Address) -> bool {
        if !env.storage().instance().has(&StorageKey::Initialized) { return false; }
        let config: VaultConfig = match env.storage().instance().get(&StorageKey::Config) {
            Some(c) => c,
            None => return false,
        };
        for i in 1..=config.lock_count {
            if let Some(lock) = env.storage().instance().get::<StorageKey, LockCore>(&StorageKey::Lock(i)) {
                if lock.beneficiary == address && lock.is_active {
                    return true;
                }
            }
        }
        false
    }
}

#[cfg(test)]
mod test;
