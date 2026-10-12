# MUSTER User Guide

A practical guide for judges, people trying the app, and the person recording the demo. The [web app](https://muster-dapp.vercel.app) runs on Monad testnet. [Versión en español](GUIA_DE_USO_ES.md).

## 1. Explore the examples without a wallet

1. Open the [app](https://muster-dapp.vercel.app). The badge at the top says **Monad testnet**; you do not need to install a wallet extension.
2. In **Market (L1)**, click **Refresh** under “Recent positions” and select **#0**. You can also enter `0` in “Position ID” and click **Load**.
3. The position should show **Defaulted** and its on-chain details. Open the [CRE report on Monad Explorer](https://testnet.monadexplorer.com/tx/0xf6dc7a5cd0527b52007ac9907070edd00f9f75287f4fdf245ede2a0361300303) to see the transaction that triggered the default.
4. In **Reputation**, enter `0xAD35Bed0058774F00Ca44884806a018Db5a51787` to see the demo provider’s public statistics. No wallet or funds are needed.
5. **Pool (L2)** lets you look up a class by entering its 32-byte `classId`. If you do not have one, use Market and Reputation; those are the paths with concrete public examples.

## 2. Complete a transaction flow on testnet

Testnet MON has no real-world monetary value, but transactions are recorded on-chain and gas spent cannot be recovered. One account can act as both provider and buyer to try the interface; this does not demonstrate a transaction between independent counterparties. To show two separate parties, use two testnet accounts and switch passkeys between roles.

1. Click **Register new passkey** and complete your device’s prompt.
2. Copy the address shown at the top and request test MON from the [Monad faucet](https://faucet.monad.xyz). Wait for it to arrive. Use a demo account; do not enter a private key or use mainnet funds.
3. Under **List new capacity**, enter:
   - Domain: `DEMO_SECURITY_RESPONSE`
   - Quantity: `1`
   - Start: a few minutes before the current time
   - End: at least one hour from now
   - SLA: `300` seconds
   - Dispute window: `300` seconds
   - Leave the panel empty and set threshold to `0`
4. Choose a small price and collateral, both greater than zero and within your test balance. Listing locks the collateral in the contract. Click **List capacity** and confirm the transaction.
5. Under “Recent positions”, open the position you just created. Click **Reserve (pay price)** and confirm the payment, then click **Activate**.
6. Because the same account listed the offer, it can also click **Accept activation (provider)** and **Claim delivery (provider)**. Enter `demo delivery` as the evidence description; the app hashes it before sending the transaction.
7. Click **Settle (buyer approves)**. The position should become **Settled**. If one account played both roles, the contract returns the price and collateral to that account at settlement. Gas is not refunded.

This flow records a delivery claim and its hash, but the contract does not verify off-chain work. Do not present this as evidence that a real service was performed.

## 3. A short path for the demo video

You do not need to create a position or wait for an SLA to show the existing evidence:

1. Open the app before recording and load position **#0**.
2. Show its **Defaulted** status and open the CRE report transaction.
3. Open **Reputation**, look up the demo provider’s address, and show the counters.
4. Close with the product idea and the app link.

If you also want to show transactions, register and fund a testnet passkey before recording. Do not rely on the faucet during the take.
