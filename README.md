# Strix Protocol

**The first on-chain options protocol on Stellar.**

Strix enables trustless European cash-settled options on XLM/USDC, underwritten by a peer-to-pool liquidity vault. Built entirely on Soroban smart contracts with Black-Scholes pricing powered by the DIA oracle.

---

## 🔗 Submission Links

| Item | Link |
|------|------|
| **Live demo** | https://strix-protocol.vercel.app |
| **Demo video** | _TBD — to be added after recording_ |
| **GitHub repo** | https://github.com/priaaa29/strix-protocol |
| **Architecture doc** | [docs/ARCHITECTURE.pdf](docs/ARCHITECTURE.pdf) |
| **User feedback** | [docs/user-feedback.xlsx](docs/user-feedback.xlsx) · [Google Form](https://docs.google.com/forms/d/e/1FAIpQLSdgWgjxcyvzHq-VZv0oWWZfVFfF_0XFj1OPmyg5FpOtc5diZg/viewform) |

### 6 Onboarded User Wallets (verifiable on Stellar testnet)

| # | Name | Role | Wallet Address |
|---|------|------|----------------|
| 1 | Rohan Sharma | Options Trader | [`GCSM3UOWL2H27WV6F63J6INHVYUKNRDHCRDZKVAW3NU6FNRQSZNNLGSW`](https://stellar.expert/explorer/testnet/account/GCSM3UOWL2H27WV6F63J6INHVYUKNRDHCRDZKVAW3NU6FNRQSZNNLGSW) |
| 2 | Ananya Iyer | Liquidity Provider | [`GBMNYAW4EVLJEPI4SXNAIIW7R3XOCMRM5WMILW7MTIBADKS37SDHPGP4`](https://stellar.expert/explorer/testnet/account/GBMNYAW4EVLJEPI4SXNAIIW7R3XOCMRM5WMILW7MTIBADKS37SDHPGP4) |
| 3 | Karan Malhotra | Market Maker | [`GCZLB4XUSS3A2K7Z6Y6D6P53EYLKDLAXWBTICCDYEPXRYOS2MAJRV2C2`](https://stellar.expert/explorer/testnet/account/GCZLB4XUSS3A2K7Z6Y6D6P53EYLKDLAXWBTICCDYEPXRYOS2MAJRV2C2) |
| 4 | Dev Patel | Arbitrageur | [`GCHPPYWSPXPAU7LK4WX5XVPKCVS3YFTPSQFJTTA6R4PPWHNVESZVHTL4`](https://stellar.expert/explorer/testnet/account/GCHPPYWSPXPAU7LK4WX5XVPKCVS3YFTPSQFJTTA6R4PPWHNVESZVHTL4) |
| 5 | Shreya Nair | Hedger | [`GCVE65B3HMCX75FQRXR7PK7SP2DPLH2XG6QMQHLGYXGS43PZ2HDAH5PN`](https://stellar.expert/explorer/testnet/account/GCVE65B3HMCX75FQRXR7PK7SP2DPLH2XG6QMQHLGYXGS43PZ2HDAH5PN) |
| 6 | Rahul Verma | Options Writer | [`GAVRQTKQ7VXJMBJKHZYK7BRI5OCJDPR26WKSDMR7JEM2WWXZI4ZPPT4L`](https://stellar.expert/explorer/testnet/account/GAVRQTKQ7VXJMBJKHZYK7BRI5OCJDPR26WKSDMR7JEM2WWXZI4ZPPT4L) |

Also viewable in-app at https://strix-protocol.vercel.app/explorer.

### Deployed contract IDs (testnet)

| Contract | ID |
|----------|------|
| PricingEngine | [`CBQDP42JG27QG4236ODSY6NZK4JJEUFKGAEVM4QZAF7KMJUNWQ2KRKJZ`](https://stellar.expert/explorer/testnet/contract/CBQDP42JG27QG4236ODSY6NZK4JJEUFKGAEVM4QZAF7KMJUNWQ2KRKJZ) |
| UnderwritingVault | [`CBVZ57IO45CEPJMJNNRXVYGLNOLEFTADHREVNHNDQ45PEFVFDQTY7WHX`](https://stellar.expert/explorer/testnet/contract/CBVZ57IO45CEPJMJNNRXVYGLNOLEFTADHREVNHNDQ45PEFVFDQTY7WHX) |
| OptionMarket | [`CCTQ3LWSSVP3ZLAXNVLXB7DTYPGFGTQ4RHDEGDKV5OT4QNO77HPYCOYX`](https://stellar.expert/explorer/testnet/contract/CCTQ3LWSSVP3ZLAXNVLXB7DTYPGFGTQ4RHDEGDKV5OT4QNO77HPYCOYX) |
| DIA Oracle | `CAEDPEZDRCEJCF73ASC5JGNKCIJDV2QJQSW6DJ6B74MYALBNKCJ5IFP4` |
| USDC (testnet SAC) | [`CBA4XQJCNN76UX3AQ63EKQXQMMIHTVENTXV2QNXLCOPMYIXAESQZUDZQ`](https://stellar.expert/explorer/testnet/contract/CBA4XQJCNN76UX3AQ63EKQXQMMIHTVENTXV2QNXLCOPMYIXAESQZUDZQ) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 14)                │
│      Stellar Wallets Kit · options chain · vault UI      │
└───────────────────┬─────────────────────────────────────┘
                    │ Soroban RPC + REST API
┌───────────────────▼─────────────────────────────────────┐
│   PricingEngine      UnderwritingVault    OptionMarket   │
│  (Black-Scholes)   (share accounting)   (buy/settle/     │
│     (DIA RPC)      (collateral mgmt)     claim)          │
└───────────────────┬─────────────────────────────────────┘
                    │ DIA oracle (on-chain push)
┌───────────────────▼─────────────────────────────────────┐
│              Backend (Express + SQLite)                  │
│           event indexer · REST API · cache               │
└─────────────────────────────────────────────────────────┘
```

## Contracts

| Contract | Description |
|----------|-------------|
| `PricingEngine` | Black-Scholes call/put premiums via DIA oracle |
| `UnderwritingVault` | USDC deposit/withdraw, share accounting, capital management |
| `OptionMarket` | Buy options, register strikes, settle expiries, claim payouts |

**Fixed-point:** All values use 7-decimal precision (`SCALE = 10_000_000`).

## Quick Start

### Prerequisites

- Rust stable + `wasm32-unknown-unknown` target
- [stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli)
- Node.js ≥ 20
- A Stellar wallet (Freighter, xBull, Lobstr, Hana) — supported via [Stellar Wallets Kit](https://stellarwalletskit.dev/)

### Run Tests

```bash
cd contracts

# Unit tests
cargo test -p pricing-engine -- --nocapture
cargo test -p underwriting-vault -- --nocapture
cargo test -p option-market -- --nocapture

# Integration tests
cargo test -p integration-tests -- --nocapture
```

### Deploy to Testnet

```bash
# 1. Generate & fund identity
stellar keys generate priya --network testnet

# 2. Deploy contracts
./scripts/deploy.sh

# 3. Initialize & wire
./scripts/initialize.sh

# 4. Seed vault with liquidity
./scripts/seed-vault.sh 5000

# 5. Create first epoch
./scripts/create-epoch.sh
```

See [docs/deployment.md](docs/deployment.md) for detailed instructions.

### Run Frontend

```bash
cd frontend
cp .env.local.example .env.local    # fill in contract IDs from .deployed.json
npm install
npm run dev
```

### Run Backend

```bash
cd backend
cp .env.example .env                # fill in contract IDs
npm install
npm run dev
```

## Options Model

- **Type:** European cash-settled
- **Underlying:** XLM/USDC (via DIA oracle, 8-decimal precision)
- **Expiries:** Weekly Fridays, 16:00 UTC
- **Strikes:** ATM ± 5/10/15/20% (9 strikes per epoch)
- **Settlement:** Any user can call `settle()` after expiry passes
- **Payout:** `max(spot - strike, 0)` per contract for calls; `max(strike - spot, 0)` for puts
- **IV:** 80% (admin-adjustable)
- **Spread:** 1% (admin-adjustable)

## API

The backend exposes a REST API for the frontend:

| Endpoint | Description |
|----------|-------------|
| `GET /api/vault/stats` | TVL, shares, locked/available capital |
| `GET /api/options/chain` | Strikes and premiums for an expiry |
| `GET /api/options/expiries` | Next 4 weekly expiries |
| `GET /api/positions/:address` | User's indexed on-chain events |
| `POST /api/feedback` | Submit user feedback |

See [docs/api.md](docs/api.md) for full API reference.

## Project Structure

```
strix-protocol/
├── contracts/
│   ├── pricing-engine/          # Black-Scholes pricing contract
│   ├── underwriting-vault/      # LP vault contract
│   ├── option-market/           # Options market contract
│   └── integration-tests/       # Cross-contract integration tests
├── frontend/                    # Next.js 14 frontend
│   ├── app/                     # App Router pages
│   ├── components/              # React components
│   ├── hooks/                   # useWallet, etc.
│   └── lib/                     # soroban.ts, constants, types
├── backend/                     # Express + SQLite indexer
│   └── src/
│       ├── api/                 # REST routes
│       └── indexer/             # Event listener + DB
├── scripts/                     # Deployment automation
└── docs/                        # Deployment + API docs
```

## User Feedback & Onboarding

We onboarded six testnet users from the Stellar community (visible on the in-app [Explorer](https://strix-protocol.vercel.app/explorer) page) via a Google Form that collects name, email, wallet address, role, rating, and free-form feedback.

- **Google Form:** https://docs.google.com/forms/d/e/1FAIpQLSdgWgjxcyvzHq-VZv0oWWZfVFfF_0XFj1OPmyg5FpOtc5diZg/viewform
- **Raw responses:** [`docs/user-feedback.xlsx`](docs/user-feedback.xlsx) ([CSV mirror](docs/user-feedback.csv))
- **Methodology + categories:** [`docs/user-feedback.md`](docs/user-feedback.md)

### Average rating: **4.5 / 5** (3 fives, 3 fours)

### Themes from the 6 responses

| Persona | What they liked | Top ask |
|---------|-----------------|---------|
| Options Trader (Rohan) | Live Black-Scholes pricing matches CEX desks | Order book / limit orders, Greeks |
| Liquidity Provider (Ananya) | One-click deposit, transparent share math | Realized 7d/30d APR (not theoretical APY), auto-compound |
| Market Maker (Karan) | Sound cross-contract architecture | Batched-buy / RFQ endpoint, WebSocket premium stream |
| Arbitrageur (Dev) | Sub-5s end-to-end settlement on testnet | `/events` endpoint with cursors, live `vault.available` |
| Hedger (Shreya) | Cash settlement, no XLM inventory needed | BTC/ETH underlyings, IV surface, deeper OTM puts (±30/40%) |
| Options Writer (Rahul) | Pooled collateral simpler than CEX margin | Per-LP attribution by strike, conservative "OTM-only" vault mode |

## Roadmap — Next Phase

Improvements below are scoped directly from the feedback above. Each ships as its own pull request so the commit history maps to user requests.

### Phase 2 priorities (next 4–6 weeks)

1. **Realized APR for LPs** (asked by Ananya, Rahul) — index premium income per epoch, expose 7d / 30d / 90d realized APR via `/api/vault/apr`. Replace the theoretical `utilization × IV × 52` estimate on the Vault page.
2. **WebSocket event stream** (asked by Karan, Dev) — add `/ws/events` to the backend that broadcasts new positions, settlements, and premium recomputations. Required for any serious MM or arb bot.
3. **Greeks on the chain UI** (asked by Rohan) — compute Δ/Γ/Θ/Vega from existing Black-Scholes machinery and surface in the buy modal + chain hover state.
4. **Tail-hedge strikes** (asked by Shreya) — extend strike grid from ±20% to ±40% (13 strikes instead of 9). Requires gas-budget audit; may need to split epoch creation across two txs.
5. **Per-LP attribution dashboard** (asked by Rahul) — breakdown of LP's premium income by strike and expiry, exposed on the Positions page when wallet has vault shares.
6. **Multi-asset underlyings** (asked by Shreya) — add BTC/USD and ETH/USD oracle feeds (DIA already supports both), deploy parallel PricingEngine instances per underlying.

### Recent improvement commits (informed by feedback)

| Commit | Change | Maps to feedback |
|--------|--------|------------------|
| [`0615e33`](https://github.com/priaaa29/strix-protocol/commit/0615e33) | Collect + ship 6 user responses as xlsx/csv | Onboarding requirement |
| [`743640a`](https://github.com/priaaa29/strix-protocol/commit/743640a) | Stop options chain flashing on 15s refresh | UX complaint from Rohan / Karan |
| [`dbd9afb`](https://github.com/priaaa29/strix-protocol/commit/dbd9afb) | Stop vault stats flashing on background refresh | UX complaint from Ananya |
| [`77b8a3b`](https://github.com/priaaa29/strix-protocol/commit/77b8a3b) | Coerce u64 fields to Number after SDK 14 upgrade | Crash report from Dev |
| [`790cf2b`](https://github.com/priaaa29/strix-protocol/commit/790cf2b) | Upgrade @stellar/stellar-sdk to 14.6.1 for Protocol 22 | "Bad union switch" on tx submit |
| [`36dc490`](https://github.com/priaaa29/strix-protocol/commit/36dc490) | Unify wallet-kit imports + share vault polling | "Random crashes after a few minutes" |

## License

MIT — see [LICENSE](LICENSE)

---

*Built for the Stellar Journey to Mastery — Blue Belt submission.*
