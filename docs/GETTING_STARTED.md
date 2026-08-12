# Getting Started with Orion Safe

Welcome to Orion Safe! This guide will help you set up and use your first multi-signature treasury vault in under 10 minutes.

---

## What is Orion Safe?

Think of Orion Safe as a **shared bank account** for your team, DAO, or organization — but with superpowers:

- **Multiple approvers required** — No single person can move funds alone
- **Spending rules** — Set daily limits, require extra approvals for large transfers
- **Full transparency** — Every action is recorded on the blockchain
- **Lightning fast** — Transactions confirm in ~5 seconds
- **Nearly free** — Each transaction costs less than $0.0001

---

## Quick Start (5 minutes)

### Step 1: Connect Your Wallet

1. Visit [stellar-vault-eta.vercel.app](https://stellar-vault-eta.vercel.app/)
2. Click **"Connect Wallet"** in the top right
3. Select your wallet:
   - **Freighter** (recommended for desktop)
   - **Lobstr** (great for mobile)
   - **xBull** or **WalletConnect**

> 💡 **Don't have a wallet?** Install [Freighter](https://www.freighter.app/) — it takes 2 minutes.

### Step 2: Create Your First Vault

1. Click **"Create Vault"**
2. Give your vault a name (e.g., "Team Treasury")
3. Add signers (wallet addresses of people who can approve transactions)
4. Set the **threshold** — how many approvals are needed
   - Example: 2-of-3 means any 2 of 3 signers must approve

### Step 3: Fund Your Vault

Send tokens to your vault address:
- Copy your vault's address from the dashboard
- Send XLM, USDC, or any Stellar asset
- Funds appear instantly

### Step 4: Make Your First Transaction

1. Go to **"Transactions"** → **"New Transaction"**
2. Enter recipient, amount, and optional memo
3. Click **"Submit Proposal"**
4. Other signers approve via their dashboard
5. Once threshold is met, anyone can execute

---

## Understanding Roles

Three roles exist today. Privilege is hierarchical — each role can do everything the one below it can.

| Role | What They Can Do |
|------|------------------|
| **SuperAdmin** | Everything — assign roles, change the threshold, add and remove signers |
| **Admin** | Manage members, plus everything an Executor can do |
| **Executor** | Create proposals, approve, reject, and execute |

> 🔐 **Best practice:** keep SuperAdmin to one or two people. Note that all three roles can currently
> propose and execute — the split between "may approve" and "may execute" arrives with the `Voter`
> and `Spender` roles, which are planned but not yet implemented.

Vault activity is public on-chain, so read-only access needs no role at all — anyone with the vault
address can inspect it.

---

## Key Features Explained

### 🔒 Multi-Signature Protection
Every transaction requires multiple approvals. Even if one key is compromised, your funds stay safe.

### ⏰ Time-Locks
Lock tokens until a specific date. Perfect for:
- Employee token vesting
- Scheduled payments
- Grant disbursements

### 📈 Vesting Schedules
Release tokens gradually over time with cliff periods. Set up once, and it runs automatically.

### 💸 Spending Limits (Not Yet Built)
Set daily/weekly/monthly limits. Transactions within limits auto-approve; larger ones need full sign-off.

---

## Supported Wallets

| Wallet | Platform | Best For |
|--------|----------|----------|
| Freighter | Browser extension | Desktop users, developers |
| Lobstr | iOS, Android, Web | Mobile-first users |
| xBull | Browser extension | Power users |
| WalletConnect | Multiple | Hardware wallets |

---

## FAQ

**Q: Is Orion Safe safe?**  
A: The contracts are open source and deliberately small — three contracts, about 1,600 lines, with no external framework dependencies — so the code you have to trust is code you can actually read. A third-party audit is a hard gate before mainnet, but is not yet scheduled. The current testnet deployment is unaudited; don't put real value at risk on it.

**Q: What tokens can I store?**  
A: Any Stellar asset — XLM, USDC, EURC, and thousands of other tokens.

**Q: How much does it cost?**  
A: Transactions cost ~$0.00001. Creating a vault requires a small XLM deposit for on-chain storage.

**Q: Can I recover my vault if I lose access?**  
A: Yes, as long as you meet the signer threshold. That's why multi-sig is safer than single-key wallets.

**Q: Is there a mobile app?**  
A: The dashboard is fully responsive. Use it on any device through your mobile browser.

---

## Need Help?

- 📖 [Full Documentation](./README.md)
- 🏗️ [Technical Architecture](./ARCHITECTURE.md)
- 🐛 [Report Issues](https://github.com/Sermium/Orion-Safe/issues)
- 📧 [Contact Us](mailto:support@orionsafe.io)

---

*Built with ❤️ on Stellar by the Orion Safe team*