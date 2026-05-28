# Stellar Vault User Guide

This guide covers all vault operations in detail.

---

## Table of Contents
1. [Dashboard Overview](#dashboard-overview)
2. [Managing Assets](#managing-assets)
3. [Creating Transactions](#creating-transactions)
4. [Time-Locks](#time-locks)
5. [Vesting Schedules](#vesting-schedules)
6. [Managing Signers](#managing-signers)
7. [Bulk Operations](#bulk-operations)

---

## Dashboard Overview

When you open your vault, you'll see:

┌─────────────────────────────────────────────────────┐ 
│             VAULT OVERVIEW                          │
├── Total Balance: $125,000 across 4 tokens           │
├── Pending Transactions: 3 awaiting approval         │
├── Active Time-Locks: 5 scheduled releases           │
├── Team Members: 4 signers (2-of-4 threshold)        │ 
└─────────────────────────────────────────────────────┘


### Navigation
- **Assets** — View balances, deposit/withdraw
- **Transactions** — Propose, approve, execute transfers
- **Time-Locks** — Lock tokens until a future date
- **Vesting** — Set up gradual token releases
- **Members** — Manage signers and roles
- **Settings** — Vault configuration

---

## Managing Assets

### Viewing Balances
The Assets page shows all tokens in your vault with:
- Current balance
- USD value (when available)
- Recent transaction history

### Depositing Funds
1.  your vault address from the dashboard
2. Send tokens from any Stellar wallet
3. Funds appear within ~5 seconds

### Withdrawing Funds
Withdrawals require a transaction proposal:
1. Go to **Transactions** → **New**
2. Select the token and amount
3. Enter the recipient address
4. Submit for approval

---

## Creating Transactions

### Standard Transfer
1. Click **"New Transaction"**
2. Fill in:
   - **Token**: Select from your vault's assets
   - **Amount**: How much to send
   - **Recipient**: Destination wallet address
   - **Memo** (optional): Note for record-keeping
3. Click **"Submit Proposal"**

### Approval Process
Proposal Created → Signers Approve → Threshold Met → Execute (You) (Team) (Auto) (Anyone)


### Checking Proposal Status
Each proposal shows:
- ✅ Who has approved
- ⏳ Who hasn't responded yet
- 📊 Progress toward threshold (e.g., "2 of 3 approved")

---

## Time-Locks

Time-locks let you schedule token releases for a future date.

### Creating a Time-Lock
1. Go to **Time-Locks** → **Create**
2. Enter:
   - **Beneficiary**: Who receives the tokens
   - **Token & Amount**: What to lock
   - **Unlock Date**: When they can claim
   - **Revocable**: Can the vault cancel this?
3. Submit (requires signer approval)

### Use Cases
- **Employee bonuses** — Lock until performance review
- **Grant milestones** — Release when deliverables complete
- **Escrow** — Hold funds until conditions are met

### Claiming Locked Tokens
Beneficiaries can claim once the unlock date passes:
1. Open the dashboard (with beneficiary wallet connected)
2. Go to **Time-Locks**
3. Click **"Claim"** on any unlocked entries

---

## Vesting Schedules

Vesting releases tokens gradually over time — perfect for team compensation or investor allocations.

### Creating a Vesting Schedule
1. Go to **Vesting** → **Create**
2. Configure:
   - **Beneficiary**: Token recipient
   - **Total Amount**: Full vesting allocation
   - **Cliff Period**: Days before any tokens release
   - **Vesting Duration**: Total days to full release
   - **Release Interval**: How often tokens unlock (daily, weekly, monthly)
3. Submit for approval

### Example: 4-Year Employee Vesting
Total: 100,000 tokens Cliff: 365 days (1 year) Duration: 1,460 days (4 years) Interval: 30 days (monthly)

Result:

Day 1-364: Nothing vests
Day 365: 25,000 tokens unlock (1-year cliff)
Day 395: ~2,083 more tokens unlock
Day 425: ~2,083 more tokens unlock
... continues monthly until Day 1,460

### Claiming Vested Tokens
1. Connect with beneficiary wallet
2. Go to **Vesting**
3. See "Available to Claim" amount
4. Click **"Claim"**

---

## Managing Signers

### Adding a New Signer
1. Go to **Members** → **Add Signer**
2. Enter their wallet address
3. Assign a role (SuperAdmin, Admin, Executor, Viewer)
4. Submit for approval (requires existing signer threshold)

### Removing a Signer
1. Go to **Members**
2. Click **"Remove"** next to the signer
3. Confirm and submit for approval

> ⚠️ **Warning:** Ensure you maintain enough signers to meet your threshold. If you have a 2-of-3 threshold and remove a signer, you'll need 2-of-2.

### Changing Threshold
1. Go to **Settings** → **Security**
2. Adjust the approval threshold
3. Submit for approval

---

## Bulk Operations

For efficiency, you can create multiple time-locks or vesting schedules at once.

### CSV Import
1. Click **"Bulk Create"** in Time-Locks or Vesting
2. Download the template CSV
3. Fill in your data:
   ```csv
   beneficiary,amount,token,unlock_date,revocable,description
   GABC...,1000,USDC,2026-12-31,true,Q4 Bonus
   GDEF...,2000,USDC,2026-12-31,true,Q4 Bonus
Upload the CSV
Review and confirm
Submit for approval
Batch Limits
Maximum 10 entries per batch (to stay within Stellar transaction limits)
Process multiple batches for larger distributions
Best Practices
Security
✅ Use hardware wallets for signer keys
✅ Keep threshold at least 2 (never single-signer)
✅ Regularly audit signer list
✅ Use separate vaults for different purposes
Operations
✅ Add descriptions to all transactions
✅ Use time-locks for anything date-sensitive
✅ Review pending transactions daily
✅ Export transaction history for accounting
Troubleshooting
Transaction stuck in pending?

Check that enough signers have approved
Ensure signers are using the correct wallet
Can't see my vault?

Confirm you're connected with a signer wallet
Check you're on the correct network (testnet vs mainnet)
Token balance not showing?

Click "Refresh" to update balances
Some new tokens may need the trustline added first
Need more help? Open an issue on GitHub