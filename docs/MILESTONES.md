## Orion Safe — Development Milestones

# Overview
This document tracks all development milestones from initial concept to mainnet launch.

# Phase 0: Initial Development ✅
Period: February - March 2026

Environment Setup
Status       Milestone
✅	        Rust & Stellar CLI installed
✅	        Testnet wallet created & funded
✅	        Development environment configured
✅	        Soroban SDK integrated

## First Contract Deployment
Item	        Value
Contract ID	    CDH3LYVDC22E2PF2JMSEHVEA3XI7YU2ICAVNUGC5O6EZ4WC3UWBOPF4P
Wallet (alice)	GAKGT2Y47BCTOTBREDAUJFPYVR2AU4G2ELY4QNKIPTCTAS7QZPXFEFZO

Status	 Milestone
✅	    Vault smart contract written
✅	    Contract compiled (9 functions)
✅	    Deployed to Stellar Testnet
✅	    Vault initialized and working

# Phase 1: Core Development ✅
Period: March - April 2026

Smart Contracts

Status	 Milestone
✅	    Factory contract developed
✅	    Vault contract with multi-sig
✅	    Proposal system (create/approve/execute)
✅	    TimeLock functionality
✅	    Vesting functionality
✅	    Role-based access control
✅	    Lock claiming mechanism

Production Contracts
Item	            Value
Factory Contract	CCNGOW6UCZKELBAR377HDHWAJJLKD6SJHUFCDT4UM6M2AYPSOEBYLDVA
Test Vault	        CBJ4BFOUDMQWFPCBALQTO2565STNGFMGQWDYVQ7MBWRZF5WSI2Z4VT5W
Network	            Stellar Testnet

Dashboard Development
Status	     Milestone
✅	        React/TypeScript project setup
✅	        Wallet integration (Freighter, Albedo, xBull, LOBSTR)
✅	        Vault creation UI
✅	        Dashboard overview
✅	        Assets view with balances
✅	        Transaction/proposal management
✅	        Members management
✅	        Settings page
✅	        Locks view (TimeLock)
✅	        Vesting view
✅	        Contacts management
✅	        Public vault view
✅	        Beneficiary claim page

Infrastructure
Status	 Milestone
✅	    Supabase database setup
✅	    Database schema (vaults, proposals, locks, signers)
✅	    RLS policies enabled
✅	    Vercel deployment
✅	    Environment configuration

# Phase 2: Bug Fixes & Polish ✅
Period: April 2026

Critical Fixes
Status	 Issue	                                     Resolution
✅	    Proposal approval_count mismatch	        DB stores approvals array, syncs with on-chain
✅	    TimeLock/Vesting null params on execute	    Added validation before execution
✅	    Lock creation wrong table	                Creates proposal first, lock on execution
✅	    ClaimPage getAllVaults[i] object bug	    Fixed to use vault_address property
✅	    CreateVaultModal [object Object]	        Added proper Address parsing
✅	    ClaimPage wallet state lost	                Added initialPublicKey/initialWalletId props
✅	    VITE_* vs REACT_APP_* env vars	            Fixed for CRA (react-scripts)
✅	    Corrupted DB entries	                    Cleaned and fixed insertion logic
✅	    Beneficiary redirect missing	            Added URL routing + vault-specific check
✅	    Contacts global storage	                    Changed to wallet-specific keys

Enhancements
Status	 Milestone
✅	    Sidebar "Claim Tokens" menu item
✅	    URL-based vault routing (?vault=XXX)
✅	    Vault-specific beneficiary detection
✅	    DB sync after claim (released_amount, deactivate)
✅	    Proposal validation before execute

# Phase 3: SCF Submission ✅
Period: April 25-26, 2026

Status	 Milestone
✅	    White paper written
✅	    Technical architecture document
✅	    MoSCoW prioritization
✅	    Roadmap document
✅	    Pitch video recorded
✅	    SCF #43 application submitted
✅	    GitHub repository public
✅	    Live demo available

Submission History
Round	    Requested	    Outcome
SCF #43	    $150,000	    Did not advance past panel review
SCF #44	    $112,500	    Did not advance past panel review
SCF #45	    $90,000	        In preparation (deadline 16 August 2026)

Panel feedback on #44 centred on novelty, team capacity, budget size relative to demonstrated
capacity, and a build thinner than the documentation claimed. The #45 scope is narrower, the budget
is costed bottom-up in person-months, and the overstated claims have been corrected — see
docs/VERIFICATION.md for the full record.

# Phase 4: Tranche 1 (Planned)
Target: award acceptance + 2 months

Status	     Milestone
⏳	        SpendLimitPolicy contract
⏳	        AllowlistPolicy contract
⏳	        Policy configuration storage
⏳	        Enhanced testnet deployment
⏳	        Updated documentation

# Phase 5: Tranche 2 (Planned)
Target: award acceptance + 4 months

Status	 Milestone
⏳	    Add Voter and Spender roles (SuperAdmin/Admin/Executor already implemented)
⏳	    Enterprise dashboard UI
⏳	    Policy configuration interface
⏳	    Native USDC optimization
⏳	    Batch operations
⏳	    3+ beta partners onboarded

# Phase 6: Tranche 3 (Planned)
Target: award acceptance + 6 months

Status	 Milestone
⏳	    Security hardening
⏳	    Professional security audit
⏳	    Mainnet contract deployment
⏳	    Compliance/audit trail features
⏳	    TypeScript SDK release
⏳	    Full documentation
⏳	    Public launch
⏳	    20+ vaults created

Milestone Summary
Phase	                        Status	         Completion
Phase 0: Initial Development	✅ Complete	    100%
Phase 1: Core Development	    ✅ Complete	    100%
Phase 2: Bug Fixes & Polish	    ✅ Complete	    100%
Phase 3: SCF Submission	        ✅ Complete	    100%
Phase 4: Tranche 1	            ⏳ Pending	    0%
Phase 5: Tranche 2	            ⏳ Pending	    0%
Phase 6: Tranche 3	            ⏳ Pending	    0%
Overall Progress: Phases 0-3 Complete | Preparing SCF #45 submission

# Key Metrics
Contracts Deployed
Factory: 1
Test Vaults: 4+
Public contract functions: 51 (vault 23, factory 14, registry 14)

# Dashboard Features
Views: 13 (Dashboard, Assets, Transactions, Members, Contacts, Locks, Vesting, Calendar, Settings, Admin, Docs, PublicVault, ClaimPage)
Modals: 10 (NewTransaction, Deposit, CreateVault, Trustline, AddToken, ConnectWallet, AuthorizeToken, BulkLock, ContactBook, ManageMembers)
Wallet Integrations: 4

# Database
Tables: 12
RLS Policies: Enabled on all tables

# Testing
Proposals Executed: 6+
Locks Created: 2 (TimeLock + Vesting)
Claims Tested: 1+

Last Updated: 7 August 2026
Status: Preparing SCF #45 submission. Testnet live and unaudited; contracts pending
redeployment after the 2026-08-07 payload-binding fix (see docs/VERIFICATION.md).