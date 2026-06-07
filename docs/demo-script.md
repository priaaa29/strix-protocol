# Strix Protocol — Demo Video Script

**Total length:** ~5 minutes
**Format:** Screen recording with voiceover (record video silent, dub voiceover in post)

---

## Scene 1 — Hook (0:00–0:20)

**[Show: Strix homepage, slow scroll through hero]**

> "Options trading has existed in traditional finance for decades — but on-chain options have always been limited by slow settlement and expensive computation.
>
> Strix Protocol brings European cash-settled options to Stellar, powered by Black-Scholes pricing and the Reflector oracle — fully on-chain, no orderbook required."

---

## Scene 2 — Architecture Overview (0:20–0:50)

**[Show: Architecture diagram from README, hover each contract as you narrate]**

> "Three Soroban contracts work together.
>
> The **PricingEngine** reads the live XLM/USD price from the Reflector oracle and runs Black-Scholes math — all in Rust, on-chain, with 7-decimal fixed-point precision.
>
> The **UnderwritingVault** holds Circle's testnet USDC from liquidity providers. It automatically locks collateral when options are sold and releases it after settlement.
>
> The **OptionMarket** is where users buy calls and puts, settle expired epochs, and claim payouts."

---

## Scene 3 — Connect Wallet (0:50–1:10)

**[Show: Click "Connect", wallet-selection modal opens, pick a wallet, extension popup, address chip appears]**

> "Let's walk through the full trading flow. I'm connecting through Stellar Wallets Kit, which supports Freighter, xBull, Lobstr, Hana, and more — users pick whichever wallet they already have."

---

## Scene 4 — Vault Deposit (1:10–1:45)

**[Show: Navigate to /vault, fill in 500 USDC, click Deposit, wallet signing, confirmation]**

> "First, I'll add liquidity to the vault. I'm depositing 500 USDC — real Circle testnet USDC, not a mock.
>
> The vault mints shares at the current share price. As option premiums flow in, share price rises, earning LPs yield.
>
> I sign the transaction, and... confirmed."

**[Show: TVL updated, "Your Position" card with share count]**

> "My shares are visible, the vault TVL has gone up by 500 USDC."

---

## Scene 5 — Buy an Option (1:45–2:45)

**[Show: Navigate to /options, expiry selector, options chain table]**

> "Now let's buy a call option. I select the upcoming expiry.
>
> The options chain shows nine strikes around at-the-money. Calls on the left, puts on the right. Premiums are quoted live — each cell is computed by the PricingEngine in real-time, not stored."

**[Show: Click ATM call strike, modal opens with premium, enter 1, click Buy Call]**

> "I'll buy one contract — that's 1 XLM of exposure — at the at-the-money strike.
>
> The premium reflects current implied volatility and time to expiry."

**[Show: Wallet popup, confirm, transaction pending, confirmed]**

> "Signed and submitted. The contract debits the premium from my wallet and locks collateral in the vault."

---

## Scene 6 — Stellar Expert Proof (insert ~2:45, ~5 seconds)

**[Show: stellar.expert testnet, paste tx hash, show contract invocation]**

> "Here's the transaction on Stellar Expert — real on-chain settlement, no simulation."

---

## Scene 7 — Settlement & Claim (2:50–3:45)

**[Show: Navigate to /positions, settled position visible]**

> "After expiry, any user can trigger settlement. The PricingEngine reads the final Reflector oracle price and calculates payouts.
>
> In this expired epoch, XLM closed above my strike — so I'm in the money."

**[Show: Click Claim, wallet sign, USDC balance increases]**

> "I claim my payout — the difference between spot and strike, multiplied by my contract amount. The vault automatically releases unused collateral back to LPs."

---

## Scene 8 — Contract Code Highlights (3:45–4:30)

**[Show: pricing-engine/src/black_scholes.rs, option-market/src/lib.rs side-by-side, scroll slowly]**

> "Under the hood, Black-Scholes runs entirely in Rust with no floating-point — pure i128 fixed-point arithmetic.
>
> The option market uses cross-contract calls to the pricing engine and vault, with authorization checks ensuring only the market contract can lock and release capital."

---

## Scene 9 — Test Results (4:30–4:50)

**[Show: terminal running `cargo test`, all green]**

> "Strix ships with a full test suite — **88 tests** across pricing, vault, option-market, and end-to-end integration. All passing.
>
> Pricing math is validated against Python scipy — all reference cases within 0.2% tolerance."

**[Show: validate_bs.py output, optional]**

---

## Scene 10 — Closing (4:50–5:00)

**[Show: Strix homepage]**

> "Strix Protocol — European options on Stellar.
>
> Built for the Stellar Journey to Mastery Blue Belt.
>
> Source code and docs at github.com/[your-handle]/strix-protocol."

---

## Pre-Recording Checklist

- [ ] Frontend deployed to Vercel with latest wallet-kit + useVault fixes
- [ ] Demo wallet funded: ~50 XLM (gas) + ~1000 Circle testnet USDC
- [ ] Vault pre-seeded so demo deposit adds to existing TVL (not bootstrapping)
- [ ] At least one expiry pre-settled with an ITM position you can claim on-camera
- [ ] Browser cache cleared, only wallet extension enabled
- [ ] `cargo test` run once so the test scene records fast
- [ ] Screen recorder set to 1920×1080
- [ ] Stellar Expert tab pre-loaded with one of your tx hashes

## Recording Checklist

- [ ] Wallet extension visible top-right throughout
- [ ] Testnet badge visible in app header throughout
- [ ] Every transaction shown to **confirmed** state (not just "submitted")
- [ ] Wallet popup kept visible when signing — don't hide it
- [ ] Stellar Expert tx page shown at least once
- [ ] Voiceover recorded separately, synced in post
- [ ] Background music subtle, royalty-free, ≤ -25 dB (optional)
- [ ] Total length ≤ 5 minutes
- [ ] Upload unlisted to YouTube first, review, then make public
