# Strix Protocol — Fee Sponsorship (Black Belt advanced feature)

Strix lets users buy options without holding XLM for gas. The protocol's sponsor account pays the network fee using Stellar's fee-bump transaction mechanism.

This is the Black Belt advanced-feature submission.

---

## Why this matters

The biggest onboarding friction for first-time Stellar users is the gas requirement: before they can do anything on-chain, they need XLM in their wallet. Friendbot solves it on testnet, but mainnet has no such facility — and even on testnet, users have to leave the app, find Friendbot, paste their address, then come back.

With fee sponsorship, that step disappears. A user can connect their wallet, click **⚡ Gasless**, and buy a call — the protocol covers the fee.

The same pattern is how Coinbase's smart-wallet, Argent, and Uniswap's gasless flows work. For Strix it's particularly valuable because **options trading is volume-driven** — every bit of friction between intent and trade costs us liquidity.

---

## How Stellar's fee-bump model works

Stellar (since Protocol 13) supports **fee-bump transactions**: an outer transaction envelope signed by a sponsor that overrides the inner transaction's source-paid fee.

```
┌────────────────────────────────────────┐
│  FeeBumpTransaction                    │
│  - feeSource: sponsor                  │
│  - fee: 10000 stroops                  │
│  - signature: sponsor signs this       │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  InnerTransaction                │  │
│  │  - source: user                  │  │
│  │  - operations: [buy_call(...)]   │  │
│  │  - signature: user signs this    │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

Two signatures, two authorizations:
- The **user** authorizes the operation (which `require_auth()` validates inside the contract).
- The **sponsor** authorizes paying the fee.

Critically, the sponsor only pays gas — it cannot move user funds. The user's signature on the inner tx is what authorizes the USDC premium debit and the call/put purchase. If the sponsor tried to substitute a different inner tx, the user's signature would no longer be valid.

---

## Architecture

```
┌───────────┐  1. wallet signs inner tx     ┌──────────────┐
│  User     │ ─────────────────────────────▶│ Frontend     │
│ (no XLM)  │     (StellarWalletsKit)       │ (Next.js)    │
└───────────┘                                └──────┬───────┘
                                                    │ 2. POST {innerXdr}
                                                    │    to /api/sponsor
                                                    ▼
                                       ┌──────────────────────────┐
                                       │ /api/sponsor             │
                                       │ (Vercel serverless route)│
                                       │                          │
                                       │ Validates:               │
                                       │  - single operation      │
                                       │  - target = OptionMarket │
                                       │  - method = buy_call /   │
                                       │             buy_put      │
                                       │  - rate limit check      │
                                       │                          │
                                       │ Wraps inner tx in        │
                                       │ FeeBumpTransaction,      │
                                       │ signs with SPONSOR_SECRET│
                                       │ submits via Soroban RPC  │
                                       └──────┬───────────────────┘
                                              │ 3. returns hash
                                              ▼
                                       ┌──────────────────────────┐
                                       │ Frontend polls tx status │
                                       │ same as the regular path │
                                       └──────────────────────────┘
```

## Source code

| Concern | File |
|---------|------|
| API route (server-side) | [`frontend/app/api/sponsor/route.ts`](../frontend/app/api/sponsor/route.ts) |
| Sponsored client helpers | [`frontend/lib/soroban.ts`](../frontend/lib/soroban.ts) — `buildAndSubmitSponsoredTx`, `buyCallSponsored`, `buyPutSponsored` |
| UI toggle | [`frontend/components/BuyOptionModal.tsx`](../frontend/components/BuyOptionModal.tsx) — the ⚡ Gasless toggle, enabled by default |
| Hook wiring | [`frontend/hooks/useOptions.ts`](../frontend/hooks/useOptions.ts) — `buyCallOption(buyer, strike, amount, sponsored)` |

## Security model

The API route enforces four invariants before signing:

| # | Check | Why |
|---|-------|-----|
| 1 | Inner tx has exactly one operation | Multi-op txs could chain a sponsored call with arbitrary side-effects |
| 2 | Operation is `invokeHostFunction` against `OPTION_MARKET_ID` | Prevents the sponsor account from being used to pay for unrelated contracts |
| 3 | Function name is in `{ buy_call, buy_put }` | Vault deposits and admin functions are not sponsored |
| 4 | Source wallet under daily rate limit (5/day) | Caps sponsor XLM drain from any one address |

If any check fails, the API returns a 4xx with a descriptive reason and the inner tx is never wrapped, never broadcast.

The sponsor secret key never leaves the Vercel serverless function. It's read from `SPONSOR_SECRET_KEY` env var on cold start and held only in process memory for the lifetime of the function instance.

## Rate limiting

Implemented in-memory in the API route:

```ts
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
```

Tracked by inner-tx source account (the user's wallet). On Vercel, the in-memory map is per-function-instance, so a determined attacker could theoretically hit multiple cold-start instances. For testnet this is acceptable — the sponsor account is funded with 10k XLM (~250M base fees), so even a tenfold abuse multiplier gives ~25M sponsored transactions before depletion.

For mainnet, this would move to:
- Redis-backed counter (Upstash free tier)
- Or: require user to hold > 0 vault shares (already-onboarded LPs only)

Both documented as Phase-3 hardening items in [`docs/security-checklist.md`](security-checklist.md).

## Proof of implementation

After deployment, the feature is verifiable via:

1. **Live demo**: open https://strix-protocol.vercel.app/options, click any Call/Put button. The buy modal shows the ⚡ Gasless toggle (on by default). Click Confirm → wallet signs → tx confirms without your wallet paying XLM.

2. **API metadata**: GET https://strix-protocol.vercel.app/api/sponsor returns:
   ```json
   {
     "service": "strix-sponsor",
     "network": "testnet",
     "sponsored_methods": ["buy_call", "buy_put"],
     "rate_limit": { "max_per_wallet": 5, "window_hours": 24 },
     "sponsor_pubkey": "GDNRA5KBR2N5UK2VCI7EG3MLNZCUQUWRNAOHCYQ62M7QOHJSYPMG6IIY"
   }
   ```

3. **On-chain proof**: any sponsored tx will show `feeAccount` ≠ `sourceAccount` on Stellar Expert. Example URL pattern after the first sponsored buy:
   `https://stellar.expert/explorer/testnet/tx/<hash>` — look for "Fee bump" badge.

4. **Sponsor account history**: every sponsored tx debits the sponsor account at https://stellar.expert/explorer/testnet/account/GDNRA5KBR2N5UK2VCI7EG3MLNZCUQUWRNAOHCYQ62M7QOHJSYPMG6IIY — outbound fee charges are the on-chain receipt.

## Deployment checklist

To make this work on the deployed Vercel app:

- [ ] Set `SPONSOR_SECRET_KEY` env var in Vercel project settings (value from `scripts/.sponsor-key.json` — local only, gitignored)
- [ ] Confirm `NEXT_PUBLIC_OPTION_MARKET_ID` matches the deployed contract
- [ ] Confirm `NEXT_PUBLIC_RPC_URL` is set
- [ ] Confirm `NEXT_PUBLIC_NETWORK` is `testnet`
- [ ] Redeploy after env var changes (Vercel needs a rebuild to bake env vars into the bundle/runtime)

Without `SPONSOR_SECRET_KEY` set, the API route returns 503 with the message *"Sponsorship temporarily unavailable — sponsor key not configured"*. The frontend then falls back to the non-sponsored path (or shows an error, depending on the user's toggle state). The non-sponsored path always works regardless.

## Why this advanced feature, not the others

Of the four Black Belt options — Fee Sponsorship, SEP-24/31 anchors, multi-sig, account abstraction — fee sponsorship is the only one that **directly removes a user onboarding step**, which is the explicit theme of the Black Belt level.

- **SEP-24** is about fiat on/off-ramps — useful but tangential to an options trading flow.
- **Multi-sig** secures admin operations — important for production, but invisible to users.
- **Account abstraction** is the most ambitious but Soroban smart-wallet examples are still maturing, making a 2-week demo risky.

Fee sponsorship is the smallest change that gives the largest UX win, with the clearest demo moment.
