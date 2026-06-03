# Strix Protocol — Demo Day Deck

Designed for a 5-minute Demo Day pitch (10 slides, ~30s per slide). Format works in Google Slides, Keynote, Gamma, or PowerPoint — paste each slide block into a fresh slide.

Speaker notes for each slide are in the **🎙️ Say:** block — read or paraphrase. Each is ~30 seconds when read aloud.

---

## Slide 1 — Title

```
STRIX PROTOCOL
The first on-chain options protocol on Stellar

European calls + puts on XLM/USDC
Black-Scholes priced. Cash settled. Soroban native.

strix-protocol.vercel.app  ·  github.com/priaaa29/strix-protocol

Built for Stellar Journey to Mastery · Black Belt
```

**🎙️ Say:** "Strix Protocol is the first on-chain options protocol on Stellar. European calls and puts on XLM/USDC, Black-Scholes priced, cash settled in USDC every Friday. It's live on testnet today."

**Visual:** Project logo on left, screenshot of the live homepage on right. Dark background, gold accent.

---

## Slide 2 — The problem

```
ON-CHAIN OPTIONS HAVE BEEN BROKEN

× Orderbook DEXs need expensive maker-taker matchmaking
× Most "options" on-chain are perpetuals in disguise
× Pricing is opaque — you can't see how a premium is computed
× Settlement requires trust in a centralised keeper

Stellar has no native options protocol at all.
```

**🎙️ Say:** "Options trading has been hard to do well on-chain. Orderbook DEXs require matchmaking infrastructure most chains can't subsidize. Other 'options' protocols are really just perpetuals. Pricing is opaque, settlement is centralised. And until now, Stellar had no native options protocol at all."

**Visual:** Four icons in a 2×2 grid for the four problems. Red X marks. Keep text minimal.

---

## Slide 3 — Our approach

```
PEER-TO-POOL OPTIONS · FULLY ON-CHAIN

✓ One LP vault underwrites every position
   → no per-strike matchmaking needed

✓ Black-Scholes priced in pure Rust i128 fixed-point
   → premiums computed live by the contract, not a server

✓ Reflector oracle (autonomous push) provides spot price
   → no keeper bot, no trusted middleman

✓ Cash settlement in USDC at Friday 8:00 UTC
   → permissionless: any user can call settle()
```

**🎙️ Say:** "Strix uses a peer-to-pool model. One vault of USDC underwrites every option position — no orderbook, no per-strike matchmaking. Black-Scholes pricing runs entirely in Rust on-chain with seven-decimal fixed-point precision. Reflector's push oracle gives us spot price without needing a keeper. And settlement is permissionless — anyone can call it after expiry."

**Visual:** Architecture diagram from docs/ARCHITECTURE.pdf. If you can do one custom slide, this is it.

---

## Slide 4 — Live demo: the flow

```
┌─────────────────────────────────────────────────┐
│  CONNECT → DEPOSIT → BUY → SETTLE → CLAIM      │
└─────────────────────────────────────────────────┘

 1. Connect wallet         (Stellar Wallets Kit)
 2. Deposit USDC to vault  (receive shares)
 3. Buy a call option      (premium paid to vault)
 4. Settle after expiry    (Reflector oracle final price)
 5. Claim USDC payout      (if ITM)
```

**🎙️ Say:** "Let's walk through the flow. Connect a wallet — we support Freighter, xBull, Lobstr, anything via Stellar Wallets Kit. Deposit USDC to underwrite. Buy a call. Settle at expiry — anyone can trigger it. Claim the payout. All five steps are live on testnet right now."

**Visual:** This slide is the cue to **switch to the live app on screen** for ~90 seconds. Walk through deposit → buy → check positions. Don't show settlement (no live expired epoch); say "in the interest of time, settlement is a one-click contract call, same shape as the others." Then return to the deck.

---

## Slide 5 — Advanced feature: Fee Sponsorship

```
⚡ GASLESS OPTIONS TRADING

The biggest onboarding step on any L1 is "get gas first."
Strix removes it for option buyers.

User signs the inner tx.
Strix sponsor account wraps it in a Stellar fee-bump envelope.
Sponsor pays the network fee. User pays only the premium.

Rate limited:  5 sponsored txs / wallet / day
Validated:     only buy_call & buy_put on our deployed contract
Verifiable:    feeAccount ≠ sourceAccount on Stellar Expert

Live now → strix-protocol.vercel.app/api/sponsor
```

**🎙️ Say:** "Strix ships with one Black Belt advanced feature: fee sponsorship. A new user can connect a wallet with zero XLM and immediately buy an option — the protocol pays the gas via Stellar's fee-bump mechanism. The sponsor account only pays for buy_call and buy_put against our market contract, and is rate-limited per wallet. Every sponsored tx is visible on Stellar Expert as a fee-bump."

**Visual:** Screenshot of the BuyOptionModal with the ⚡ Gasless toggle highlighted. If space, a snippet of the API response from `GET /api/sponsor` underneath.

---

## Slide 6 — Under the hood

```
SOROBAN ARCHITECTURE

3 contracts · 92 tests passing · 0 mocks left

┌────────────────┐   ┌─────────────────────┐   ┌──────────────┐
│ PricingEngine  │   │ UnderwritingVault   │   │ OptionMarket │
│ Black-Scholes  │ ◀▶│ Shares, capital     │ ◀▶│ Buy / Settle │
│ in i128        │   │ lock/release        │   │ / Claim       │
└───────┬────────┘   └──────────┬──────────┘   └──────┬───────┘
        │                       │                     │
        └──────────────────┬────┴─────────────────────┘
                           ▼
                  Reflector Oracle  ·  Circle testnet USDC

Math validated against Python scipy reference.
Worst-case error across 5 canonical strikes: 0.18 %.
```

**🎙️ Say:** "Three Soroban contracts, ninety-two tests passing. PricingEngine runs the Black-Scholes math in pure i128 fixed-point arithmetic — no floats, no surprises. Vault holds the LP capital and tracks share-price appreciation as premiums flow in. OptionMarket is the user-facing entry point with cross-contract calls to both. Our pricing math is validated against Python scipy — worst-case error under two-tenths of a percent."

**Visual:** Same architecture cells as Slide 3 but zoomed-in. Optional: a code snippet of `calc_call_premium` from PricingEngine. Don't over-explain the math.

---

## Slide 7 — Onboarding & feedback

```
30 ONBOARDED WALLETS · 6 USER INTERVIEWS

Phase 1 (6 users · written feedback)
  Average rating: 4.5 / 5
  Top asks: realized APR, Greeks, WebSocket events, deep OTM puts

Phase 2 (24 users · scaled cohort)
  Global coverage: IN, DE, IT, PT, PL, DK, ES, US, MX, CA,
                   BR, JP, KR, SG, AU, AE

All 30 wallets visible at strix-protocol.vercel.app/explorer
All wallets verifiable on Stellar Expert
```

**🎙️ Say:** "We onboarded thirty users — six gave detailed written feedback through our Google Form, twenty-four more from a global geographic spread. Every wallet is funded on testnet and listed on our Explorer page, each verifiable on Stellar Expert. Average rating four-point-five out of five. The top feedback themes — realized APR for LPs, Greeks in the chain UI, deeper OTM puts for hedgers — are already in our Phase-2 roadmap."

**Visual:** A pin map of the 16 countries, with sub-callout of the rating + top three asks. If a pin map is too much work, just stack the country list as a flowing wrap.

---

## Slide 8 — Operations & security

```
PRODUCTION-READINESS

Live metrics       strix-protocol.vercel.app/metrics
Live health        /api/health  (DB · RPC · indexer lag)
Indexer            SQLite + 30s poll, resume-safe across restarts
Security audit     30+ items reviewed (Soroban-specific, authz,
                   oracle, economic, frontend, ops)

What's deferred to mainnet:
  • External audit
  • Multi-sig on admin functions
  • Sentry SDK + bug bounty
```

**🎙️ Say:** "On the operations side: live metrics dashboard, health endpoint covering database, RPC, and indexer lag. A resume-safe event indexer. A thirty-item security checklist covering Soroban-specific patterns like require_auth and TTL extension, plus the usual authz, oracle, and economic attack surface. We document the things we deliberately defer to mainnet — external audit, multi-sig, Sentry — so reviewers can see the reasoning, not just the gaps."

**Visual:** Screenshot of the /metrics page. Live numbers > static description.

---

## Slide 9 — Roadmap

```
NEXT 4–6 WEEKS (Phase 2)

1. Realized APR for LPs        (asked by Ananya, Rahul)
2. WebSocket event stream      (asked by Karan, Dev)
3. Greeks in chain UI          (asked by Rohan)
4. Tail-hedge strikes ±40 %    (asked by Shreya)
5. Per-LP attribution dashboard (asked by Rahul)
6. Multi-asset underlyings     (BTC/USD, ETH/USD via Reflector or DIA)

Each ships as its own PR. Commit history maps to user feedback.
```

**🎙️ Say:** "Our Phase-2 roadmap is fully scoped from user feedback. Realized APR for LPs, WebSocket events for market makers, Greeks for active traders, deeper out-of-the-money puts for hedgers, per-LP attribution dashboards, and multi-asset underlyings using the same Reflector oracle. Every item ships as its own pull request so the commit history maps directly back to a specific piece of feedback."

**Visual:** Numbered list, no clutter. Each line tagged with the user who asked for it.

---

## Slide 10 — The ask

```
STRIX PROTOCOL

🟢 strix-protocol.vercel.app
📦 github.com/priaaa29/strix-protocol
📐 docs/ARCHITECTURE.pdf
📊 docs/security-checklist.md
🎬 [demo video URL]

Built for the Stellar Journey to Mastery
Submitting Black Belt

We're looking for:
  • Mainnet partners (LPs, market makers)
  • Feedback on what to build next
  • A path to audit before mainnet
```

**🎙️ Say:** "Strix Protocol — the first options protocol on Stellar. We're submitting today for the Black Belt level. We'd love mainnet partners, more user feedback, and a path to external audit before we go live. Repo and docs are linked here. Thanks."

**Visual:** Big logo + URL block on the left, three asks on the right.

---

## Production notes

### Tools to convert this into a slide deck

| Tool | How |
|------|-----|
| **Gamma** (recommended for speed) | Paste this entire Markdown into Gamma's "Paste in text" input. Each `---` becomes a slide break. |
| **Google Slides** | Create slides manually; paste the text-art block + edit. Fastest if you already use it. |
| **Keynote** | Use the dark theme; paste text into "Title + Content" templates. |
| **Pitch.com** | Markdown import handles the `---` breaks natively. |

### Recommended visual style

- **Dark background** (matches the app)
- **Gold accent** for callouts (`#F0B232` or similar)
- **Mint green** for "✓" and on-state badges
- **Rust red** sparingly for problem statements
- **Monospace** for code/contract IDs
- **Display font** (e.g. Inter Display, Tiempos Display) for headers

### What to prep beforehand

- [ ] One slide with the **architecture diagram** as a full-bleed image, exported from `docs/ARCHITECTURE.pdf` page 1
- [ ] A **15-second pre-recorded screencap** of the buy flow as a fallback if the live demo fails on stage
- [ ] Stellar Expert tab open in the background showing a fee-bumped sponsored tx — for the "feeAccount ≠ sourceAccount" proof if asked
- [ ] Terminal tab open showing `cargo test` output for the 92 tests — only show if challenged on testing
- [ ] **One-line answer for the most likely question** ("Why Stellar and not Solana / Arbitrum?") — _because Soroban's authorization model and sub-cent fees make options sustainable at small contract sizes, where every other chain economically excludes retail._

### Timing

| Slide | Budget |
|-------|--------|
| 1 — Title | 15 s |
| 2 — Problem | 30 s |
| 3 — Approach | 30 s |
| 4 — Live demo intro + walkthrough | 90 s |
| 5 — Fee sponsorship | 30 s |
| 6 — Tech | 30 s |
| 7 — Onboarding | 30 s |
| 8 — Ops & security | 25 s |
| 9 — Roadmap | 20 s |
| 10 — Ask | 20 s |
| **Total** | **5 min 0 s** |

Pad slides 4 and 5 if the demo is the centerpiece; trim slides 2 and 9 if the audience is already familiar with Stellar / options markets.
