# Strix Protocol

**The first on-chain options protocol on Stellar.**

Strix enables trustless European cash-settled options on XLM/USDC, underwritten by a peer-to-pool liquidity vault. Built entirely on Soroban smart contracts with Black-Scholes pricing powered by the Reflector oracle.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 14)                │
│         Freighter wallet · options chain · vault UI      │
└───────────────────┬─────────────────────────────────────┘
                    │ Soroban RPC + REST API
┌───────────────────▼─────────────────────────────────────┐
│   PricingEngine      UnderwritingVault    OptionMarket   │
│  (Black-Scholes)   (share accounting)   (buy/settle/     │
│  (Reflector RPC)   (collateral mgmt)     claim)          │
└───────────────────┬─────────────────────────────────────┘
                    │ Reflector oracle (on-chain)
┌───────────────────▼─────────────────────────────────────┐
│              Backend (Express + SQLite)                  │
│           event indexer · REST API · cache               │
└─────────────────────────────────────────────────────────┘
```

## Contracts

| Contract | Description |
|----------|-------------|
| `PricingEngine` | Black-Scholes call/put premiums via Reflector oracle |
| `UnderwritingVault` | USDC deposit/withdraw, share accounting, capital management |
| `OptionMarket` | Buy options, register strikes, settle expiries, claim payouts |

**Fixed-point:** All values use 7-decimal precision (`SCALE = 10_000_000`).

## Quick Start

### Prerequisites

- Rust stable + `wasm32-unknown-unknown` target
- [stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli)
- Node.js ≥ 20
- [Freighter wallet](https://freighter.app) (browser extension)

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
- **Underlying:** XLM/USDC (via Reflector oracle)
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

## License

MIT — see [LICENSE](LICENSE)

---

*Built for the Stellar Journey to Mastery — Blue Belt submission.*
