# Strix Protocol — Deployment Guide

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh` |
| stellar CLI | ≥ 0.0.47 | `cargo install --locked stellar-cli` |
| Node.js | ≥ 20 | `brew install node` / nvm |
| jq | any | `brew install jq` |
| bc | any | pre-installed on macOS/Linux |

## Step 1 — Generate & Fund a Testnet Identity

```bash
stellar keys generate priya --network testnet
stellar keys address priya         # copy this address
```

Fund via Friendbot:
```
https://friendbot.stellar.org/?addr=<YOUR_ADDRESS>
```

## Step 2 — Get Testnet USDC

The testnet USDC token is:
```
CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
```

Mint some via the `mint-test-usdc.sh` script:
```bash
./scripts/mint-test-usdc.sh
```

## Step 3 — Deploy Contracts

```bash
./scripts/deploy.sh
```

This builds all 3 WASM contracts, deploys them to testnet, and writes `.deployed.json`.

## Step 4 — Initialize Contracts

```bash
./scripts/initialize.sh
```

This wires PricingEngine → Reflector oracle, Vault → USDC, OptionMarket → all dependencies.
Writes `.env.testnet` with all contract IDs.

## Step 5 — Seed Vault

```bash
./scripts/seed-vault.sh 5000    # deposits 5,000 USDC
```

## Step 6 — Create First Epoch

```bash
./scripts/create-epoch.sh
```

Registers the next Friday expiry and creates 9 strikes (ATM ± 5/10/15/20%).

## Step 7 — Configure Frontend

```bash
# Copy .env.testnet values to frontend/.env.local
cp .env.testnet frontend/.env.local.tmp
# Then in frontend/.env.local:
NEXT_PUBLIC_PRICING_ENGINE_ID=<from .env.testnet>
NEXT_PUBLIC_VAULT_ID=<from .env.testnet>
NEXT_PUBLIC_OPTION_MARKET_ID=<from .env.testnet>
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Step 8 — Configure Backend

```bash
cp backend/.env.example backend/.env
# Then fill in:
PRICING_ENGINE_ID=<from .deployed.json>
VAULT_ID=<from .deployed.json>
OPTION_MARKET_ID=<from .deployed.json>
```

## Step 9 — Run

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Open http://localhost:3000
```

## Verifying on Stellar Expert

```
https://stellar.expert/explorer/testnet/contract/<CONTRACT_ID>
```

## Contract Addresses

After deployment, find all IDs in `.deployed.json`:
```json
{
  "network": "testnet",
  "pricingEngine": "C...",
  "vault": "C...",
  "optionMarket": "C...",
  "deployedAt": "..."
}
```

## Reflector Oracle

The testnet Reflector oracle is:
```
CCQNF6FO7WXRXDRMQHBX5YIMJQUPEWBM6BBO76M5WQVNV4IN5PJMQF7
```

See https://reflector.network for docs.
