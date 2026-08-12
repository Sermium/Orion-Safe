# Frequently Asked Questions

Quick answers to common questions about Orion Safe.

---

## General

### What is Orion Safe?
Orion Safe is an enterprise-grade multi-signature treasury platform built on Stellar's Soroban smart contracts. It lets teams, DAOs, and organizations manage shared funds with customizable approval rules.

### How is this different from a regular Stellar wallet?
| Regular Wallet | Orion Safe |
|----------------|---------------|
| Single key controls everything | Multiple approvals required |
| No spending rules | Configurable policies |
| No audit trail | Every action logged |
| One person risk | Distributed control |

### Is Orion Safe free?
The platform is free to use. You only pay standard Stellar network fees (~$0.00001 per transaction) plus a small storage deposit when creating vaults.

### What networks are supported?
- **Testnet** — Currently live for testing
- **Mainnet** — Not yet deployed

---

## Security

### Is my money safe?
Orion Safe is designed to keep the code you have to trust as small as possible:
- Three contracts, about 1,600 lines total, with no external framework dependencies
- Battle-tested multi-signature patterns, enforced on-chain
- Funds committed to a lock or vesting schedule cannot be spent by a later proposal
- Stellar's secure, decentralized network

A third-party audit is a hard gate before mainnet, but is not yet scheduled. Treat the current
testnet deployment as unaudited software and do not put real value at risk.

No single person (including our team) can access your vault. Only signers with the required threshold can authorize transactions.

### What if I lose my private key?
As long as the remaining signers meet the threshold, the vault remains accessible. That's the power of multi-sig!

**Example:** In a 2-of-3 vault, if one key is lost, the other 2 signers can:
1. Access the vault normally
2. Add a new signer
3. Remove the lost key

### Can Orion Safe access my funds?
**No.** Your vault is a smart contract on Stellar. Only the signers you add can authorize transactions. We have no special access.

### Will there be a security audit?
Yes — a third-party audit is a hard gate before mainnet. It is not yet scheduled, as it depends on funding that has not been secured.

---

## Features

### What tokens can I store?
Any Stellar asset:
- XLM (native)
- USDC, EURC (stablecoins)
- Anchored assets (fiat-backed tokens)
- Any SEP-41 compatible token

### How many signers can a vault have?
The contract sets no hard cap. Practical limits come from transaction size and the cost of iterating the signer list, so large signer sets are untested — treat anything beyond about 10 as unvalidated.

### Can I have multiple vaults?
Yes! Create as many vaults as you need — one for operations, one for reserves, one for each project, etc.

### What are time-locks?
Time-locks let you deposit tokens that can only be claimed after a specific date. Perfect for bonuses, grants, or escrow.

### What is vesting?
Vesting releases tokens gradually over time, often with a "cliff" (minimum time before any release). Common for employee compensation or investor tokens.

### Can I cancel a time-lock or vesting schedule?
Only if it was created with **revocable = true**, and only by proposal. Cancellation goes through the
same propose → approve → execute flow as moving funds, because releasing a commitment is as
consequential as spending it — no single administrator can revoke a beneficiary's schedule alone.

Schedules created with **revocable = false** can never be cancelled by anyone.

---

## Transactions

### How long do transactions take?
About 5 seconds after execution. The approval process depends on how quickly your signers respond.

### What if a signer doesn't respond?
You have options:
- Wait for them
- If you have enough other signers, proceed without them
- In emergencies, SuperAdmins can remove unresponsive signers (requires threshold approval)

### Can I cancel a pending transaction?
There is no cancel function. Signers **reject** instead: once rejections reach the vault threshold, the proposal is permanently marked rejected and can never execute. Each rejection is recorded on-chain individually, so the record shows who declined.

### Is there a transaction limit?
No hard limit on amounts. Configurable spending policies are designed but not yet built.

---

## Technical

### What is Soroban?
Soroban is Stellar's smart contract platform. It lets us build programmable logic (like multi-sig, time-locks, and policies) directly on the blockchain.

### Do I need to know programming?
No — the dashboard covers all operations. Developers can call the contracts directly with the Stellar SDK today; a dedicated TypeScript client package is planned.

### Which wallets work with Orion Safe?
- Freighter (browser extension)
- Lobstr (mobile + web)
- xBull (browser extension)
- WalletConnect-compatible wallets

### Can I use a hardware wallet?
Yes, through WalletConnect or wallets that support Ledger (like Lobstr).

---

## Troubleshooting

### I connected my wallet but can't see any vaults
- Confirm you're connected with a signer address
- Check you're on the correct network (testnet/mainnet)
- Try disconnecting and reconnecting your wallet

### Transaction failed with an error
Common causes:
- **Insufficient balance** — Check vault has enough tokens + XLM for fees
- **Threshold not met** — More approvals needed
- **Already executed** — Someone else executed it first
- **Network congestion** — Wait a moment and retry

### My balance isn't updating
- Click the "Refresh" button
- Check the transaction on [Stellar Expert](https://stellar.expert/) to confirm it processed
- Hard refresh your browser (Ctrl+Shift+R)

---

## Contact & Support

### How do I report a bug?
Open an issue on [GitHub](https://github.com/Sermium/Orion-Safe/issues)

### How do I request a feature?
Open a GitHub issue with the "enhancement" label

### Is there a community?
Coming soon! Discord and Telegram communities are planned for mainnet launch.

### Security concerns?
Email [security@orionsafe.io](mailto:security@orionsafe.io) for security-related issues. Do not post security vulnerabilities publicly.

---

*Last updated: 7 August 2026*