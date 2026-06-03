# Strix Protocol — Twitter Launch Thread

The community contribution for Black Belt: a launch thread to share Strix with the Stellar dev community.

Replace `[ATTACH SCREENSHOT]` markers with actual screenshots when posting. Each tweet stays under 280 chars.

---

## Tweet 1 (hook) — pin this

> Introducing **Strix Protocol** — the first on-chain options protocol on Stellar.
>
> European calls + puts on XLM/USDC, Black-Scholes priced live by Soroban contracts, cash-settled weekly.
>
> 🔗 https://strix-protocol.vercel.app
>
> Thread on what we built ↓ 🧵
>
> [ATTACH SCREENSHOT: homepage hero with live XLM price ticker]

## Tweet 2 (the architecture)

> Three Soroban contracts under the hood:
>
> 1️⃣ PricingEngine — Black-Scholes math in pure i128 fixed-point. No floats.
> 2️⃣ UnderwritingVault — LP pool, share accounting, collateral management.
> 3️⃣ OptionMarket — buy / settle / claim, with cross-contract calls.
>
> [ATTACH SCREENSHOT: docs/ARCHITECTURE.pdf cover page]

## Tweet 3 (the live demo)

> Live options chain — ATM + 8 OTM/ITM strikes, every premium computed in real-time by the on-chain Black-Scholes engine reading from Reflector oracle.
>
> No off-chain price server. No cached premiums. It's all Soroban.
>
> [ATTACH SCREENSHOT: /options page showing 9 strikes with live premiums]

## Tweet 4 (the math is honest)

> Pricing math validated against Python scipy reference across 5 canonical strikes.
> All within 0.2% tolerance.
>
> Plus 92 tests passing across the 3 contracts and end-to-end integration.
>
> [ATTACH SCREENSHOT: terminal showing `cargo test` with green test results]

## Tweet 5 (LP yield story)

> LPs deposit USDC to underwrite options. Share price appreciates as premiums flow in. When options expire OTM, all locked capital releases back automatically.
>
> Simple model. No per-strike margin to manage.
>
> [ATTACH SCREENSHOT: /vault page with TVL + share price]

## Tweet 6 (the community)

> Onboarded 30 testnet users across India, Europe, Americas, APAC, MENA — options traders, LPs, market makers, hedgers.
>
> All wallets verifiable on Stellar Expert.
>
> [ATTACH SCREENSHOT: /explorer page showing trader cards]

## Tweet 7 (call to action)

> 🟢 Live demo: https://strix-protocol.vercel.app
> 📄 Code: https://github.com/priaaa29/strix-protocol
> 📐 Architecture: github.com/priaaa29/strix-protocol/blob/main/docs/ARCHITECTURE.pdf
> ⭐ Star the repo if you want to see options on Stellar mainnet
>
> Built for the @StellarOrg Journey to Mastery. Feedback welcome.

---

## When to post

After the demo video is recorded and you have 4–6 good screenshots from it. Tag `@StellarOrg`, `@Soroban`, and any Stellar community accounts you know on tweets 1 and 7.

## After posting

Once posted, paste the tweet URL into the README "Community Contribution" row so the submission table links to a real artifact:

```md
| Community contribution | [Twitter launch thread](https://x.com/<handle>/status/<id>) |
```

Then commit:

```bash
git commit -m "docs: link Twitter launch thread for community contribution"
```

## Why a thread, not a single tweet

The Black Belt rubric asks for "a post about your product." A 7-tweet thread (vs. one tweet + link) demonstrates depth, gives the reviewer a clear narrative when they click through, and is the format the Stellar dev community typically engages with on X.
