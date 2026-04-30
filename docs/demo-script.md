# Strix Protocol — Demo Video Script

**Total length:** ~5 minutes  
**Format:** Screen recording with voiceover

---

## Scene 1 — Hook (0:00–0:20)

**[Show: Strix homepage]**

> "Options trading has existed in traditional finance for decades — but on-chain options have always been limited by slow settlement and expensive computation.
>
> Strix Protocol brings European cash-settled options to Stellar, powered by Black-Scholes pricing and the Reflector oracle — fully on-chain, no orderbook required."

---

## Scene 2 — Architecture Overview (0:20–0:50)

**[Show: Architecture diagram from README, or draw on screen]**

> "Three Soroban contracts work together.
>
> The **PricingEngine** fetches the live XLM/USDC price from the Reflector oracle and runs Black-Scholes math — all in Rust, on-chain, with 7-decimal precision.
>
> The **UnderwritingVault** holds USDC from liquidity providers. It automatically locks collateral when options are sold and releases it after settlement.
>
> The **OptionMarket** is where users buy calls and puts, settle expired epochs, and claim payouts."

---

## Scene 3 — Connect Wallet (0:50–1:10)

**[Show: Click "Connect Freighter", Freighter popup, wallet address appears]**

> "Let's walk through the full trading flow. I'm connecting my Freighter wallet — the leading Stellar wallet.
>
> The app detects my network automatically. If I were on mainnet, it would warn me to switch to testnet."

---

## Scene 4 — Vault Deposit (1:10–1:45)

**[Show: Navigate to /vault, fill in 500 USDC, click Deposit, Freighter signing, confirmation]**

> "First, I'll add liquidity to the vault. I'm depositing 500 USDC.
>
> The vault mints me shares — notice the share price is 1 USDC per share right now. As options premiums flow in, that price will rise, earning LPs yield.
>
> I sign the transaction with Freighter and... confirmed."

**[Show: TVL updated, shares balance shown]**

> "My shares are now visible. The vault shows 500 USDC TVL."

---

## Scene 5 — Buy an Option (1:45–2:45)

**[Show: Navigate to /options, expiry selector, options chain table]**

> "Now let's buy a call option. I select the upcoming Friday expiry.
>
> The options chain shows 9 strikes — ATM is around 12 cents per XLM right now. Calls are listed left, puts right."

**[Show: Click ATM call strike, premium displayed, enter amount, click Buy Call]**

> "I'll buy one contract — that's 1 XLM worth of exposure — at the ATM strike.
>
> The premium is 0.01 USDC, reflecting the high implied volatility and short time to expiry."

**[Show: Freighter popup, confirm, transaction pending, confirmed]**

> "Signed and submitted. The contract debits the premium from my wallet and locks collateral in the vault."

---

## Scene 6 — Settlement & Claim (2:45–3:45)

**[Show: Navigate to /positions, settled position visible]**

> "After expiry, any user can trigger settlement. The PricingEngine reads the final oracle price and calculates payouts.
>
> In this test epoch, XLM expired above my strike — so I'm in the money."

**[Show: Click Claim, Freighter sign, USDC received confirmation]**

> "I claim my payout — the difference between spot and strike, multiplied by my contract amount.
>
> The vault automatically releases unused collateral back to LPs."

---

## Scene 7 — Contract Code Highlights (3:45–4:30)

**[Show: pricing-engine/src/black_scholes.rs, option-market/src/lib.rs briefly]**

> "Under the hood, the Black-Scholes implementation runs entirely in Rust with no floating-point — pure i128 fixed-point arithmetic.
>
> The option market uses cross-contract calls to the pricing engine and vault, with authorization checks ensuring only the market contract can lock and release capital.
>
> All 88 tests pass — 32 unit tests for pricing, 31 for the market, and 8 end-to-end integration tests with real cross-contract calls."

---

## Scene 8 — Test Results (4:30–4:50)

**[Show: terminal running `cargo test`, all green]**

> "Strix ships with a full test suite. Pricing math is validated against Python scipy — all five test cases within 0.2% tolerance."

**[Show: validate_bs.py output]**

---

## Scene 9 — Closing (4:50–5:00)

**[Show: Strix homepage]**

> "Strix Protocol — the first options protocol on Stellar.
>
> Built for the Stellar Journey to Mastery Blue Belt.
>
> Source code and docs at github.com/[your-handle]/strix-protocol."

---

## Recording Checklist

- [ ] Screen recording at 1920×1080
- [ ] Freighter wallet visible in top-right corner
- [ ] Testnet badge visible in app header throughout
- [ ] All transactions confirmed on-screen (not just submitted)
- [ ] Show Stellar Expert transaction link at least once
- [ ] Voiceover recorded separately, synced in post
- [ ] Background music: subtle, royalty-free (optional)
- [ ] Total length ≤ 5 minutes
- [ ] Upload to YouTube (unlisted) and include link in submission
