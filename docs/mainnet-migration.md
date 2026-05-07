# Mainnet Migration Guide

Steps to migrate Strix Protocol from testnet to Stellar mainnet.

---

## 1. Prerequisites

- Funded mainnet admin wallet (minimum ~10 XLM for transaction fees)
- Stellar CLI configured with mainnet key: `stellar keys add <alias> --secret-key`
- Rust + Soroban toolchain installed (`cargo install --locked soroban-cli`)
- Access to your backend `.env` and frontend `.env.local`

---

## 2. Key Addresses for Mainnet

| Resource | Address |
|----------|---------|
| **Reflector Oracle (XLM/USDC)** | `CCQNF6FO7WXRXDRMQHBX5YIMJQUPEWBM6BBO76M5WQVNV4IN5PJMQF7` |
| **Native USDC SAC (Circle)** | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7EJJUD` |
| **Stellar Expert (mainnet)** | `https://stellar.expert/explorer/public` |

> Verify these addresses independently before deployment. Oracle and USDC addresses are fixed but confirm with official Stellar/Circle/Reflector sources.

---

## 3. Deploy Contracts to Mainnet

```bash
# Switch Stellar CLI to mainnet
export NETWORK=mainnet

# Deploy and initialize
./scripts/deploy.sh mainnet
./scripts/initialize.sh mainnet

# initialize.sh will prompt for:
#   - Admin address (your funded mainnet wallet)
#   - Oracle address (Reflector mainnet above)
#   - USDC token address (Circle SAC above)
#   - Max TVL cap (start conservative: 100_000_0000000 = 100k USDC)
```

After running, `.deployed.json` will be updated with mainnet contract IDs.

---

## 4. Update Backend `.env`

```bash
NETWORK=mainnet
RPC_URL=https://soroban-rpc.mainnet.stellar.gateway.fm
HORIZON_URL=https://horizon.stellar.org
NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015

# Fill from .deployed.json
PRICING_ENGINE_ID=<mainnet_pricing_engine>
VAULT_ID=<mainnet_vault>
OPTION_MARKET_ID=<mainnet_option_market>
USDC_TOKEN_ID=CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7EJJUD
ORACLE_ID=CCQNF6FO7WXRXDRMQHBX5YIMJQUPEWBM6BBO76M5WQVNV4IN5PJMQF7

ADMIN_ADDRESS=<your_mainnet_public_key>
STELLAR_KEY_ALIAS=<your_mainnet_keystore_alias>

# Oracle keeper is NOT needed on mainnet — Reflector is autonomous.
# Set ORACLE_PRICE_14DEC to empty or remove; the keeper will skip if ORACLE_ID
# points to real Reflector (which doesn't have set_price).

CORS_ORIGINS=https://yourdomain.com
ADMIN_API_KEY=<generate_with: openssl rand -hex 32>
```

---

## 5. Update Frontend `.env.local`

```bash
NEXT_PUBLIC_NETWORK=mainnet

# Fill from .deployed.json
NEXT_PUBLIC_PRICING_ENGINE_ID=<mainnet_pricing_engine>
NEXT_PUBLIC_VAULT_ID=<mainnet_vault>
NEXT_PUBLIC_OPTION_MARKET_ID=<mainnet_option_market>
NEXT_PUBLIC_USDC_TOKEN_ID=CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7EJJUD
NEXT_PUBLIC_ORACLE_ID=CCQNF6FO7WXRXDRMQHBX5YIMJQUPEWBM6BBO76M5WQVNV4IN5PJMQF7

NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_RPC_URL=https://soroban-rpc.mainnet.stellar.gateway.fm
NEXT_PUBLIC_HORIZON_URL=https://horizon.stellar.org
```

---

## 6. Oracle Keeper on Mainnet

The oracle-keeper calls `set_price` on the **MockOracle** contract — this only exists on testnet.
On mainnet, the **Reflector oracle** is maintained by the Reflector team and updates automatically.

**Action:** Leave the oracle keeper running but it will silently skip (the `set_price` call will
fail gracefully since Reflector doesn't expose that function). Alternatively, disable it:

```bash
# In backend .env — unset the oracle ID to disable the keeper
ORACLE_ID=
```

The settlement keeper still runs on mainnet and is required.

---

## 7. Multi-Sig Admin (Recommended Before Launch)

The current admin is a single Stellar keypair. For production, upgrade to multi-sig:

1. Create 3-5 additional Stellar accounts (signers)
2. On the admin account: `stellar account add-signer --weight 1 <signer_pubkey>` (repeat for each)
3. Set medium/high threshold to require 2-of-N signatures
4. Test: a single key should no longer be able to call `create_epoch` alone

This protects against admin key compromise. Do this **before** seeding significant TVL.

---

## 8. Pre-Launch Checklist

- [ ] Contracts deployed and initialized on mainnet
- [ ] `vault.set_option_market(option_market)` called as admin
- [ ] Initial liquidity seeded (`./scripts/seed-vault.sh mainnet`)
- [ ] First epoch created (`./scripts/create-epoch.sh mainnet`)
- [ ] Backend running with correct mainnet env vars
- [ ] Settlement keeper verified running (`GET /health` shows `rpc: ok`)
- [ ] Frontend deployed with `NEXT_PUBLIC_NETWORK=mainnet`
- [ ] CORS set to production domain
- [ ] ADMIN_API_KEY set and tested
- [ ] Bought a test option and verified settlement end-to-end
- [ ] Reflector oracle price visible on dashboard (not stale)
