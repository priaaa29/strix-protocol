#!/bin/bash
# deploy.sh — Deploy all Strix Protocol contracts to Stellar testnet.
#
# Prerequisites:
#   - stellar CLI installed and configured
#   - Identity "priya" exists: stellar keys generate priya
#   - Testnet XLM funded via Friendbot
#
# Usage:
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh

set -euo pipefail

NETWORK="testnet"
SOURCE="priya"
WASM_DIR="contracts/target/wasm32v1-none/release"

# Reflector oracle on Stellar testnet (live, free, 5-minute updates)
REFLECTOR_ORACLE_ID="CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63"
# Testnet USDC SAC (issuer: GBPOKGY3JM6JZAAMKNYNDTKKWXH46SI3PLLJX2DARZ4QXS7WVL4WYQBA)
USDC_ID="CBA4XQJCNN76UX3AQ63EKQXQMMIHTVENTXV2QNXLCOPMYIXAESQZUDZQ"

echo "======================================================"
echo "   Strix Protocol — Testnet Deployment"
echo "======================================================"
echo ""

# ── Build ──────────────────────────────────────────────────────────────────────
echo "📦 Building contracts..."
cd contracts
stellar contract build 2>&1 || { echo "❌ Build failed"; exit 1; }
cd ..
echo "✅ Build complete"
echo ""

echo "📡 Using Reflector oracle (testnet): $REFLECTOR_ORACLE_ID"
echo "💵 Using testnet USDC: $USDC_ID"
echo ""

# ── Deploy PricingEngine ───────────────────────────────────────────────────────
echo "🚀 Deploying PricingEngine..."
PRICING_ID=$(stellar contract deploy \
    --wasm "$WASM_DIR/pricing_engine.wasm" \
    --source "$SOURCE" \
    --network "$NETWORK")
echo "   PricingEngine: $PRICING_ID"

# ── Deploy UnderwritingVault ───────────────────────────────────────────────────
echo "🚀 Deploying UnderwritingVault..."
VAULT_ID=$(stellar contract deploy \
    --wasm "$WASM_DIR/underwriting_vault.wasm" \
    --source "$SOURCE" \
    --network "$NETWORK")
echo "   UnderwritingVault: $VAULT_ID"

# ── Deploy OptionMarket ────────────────────────────────────────────────────────
echo "🚀 Deploying OptionMarket..."
MARKET_ID=$(stellar contract deploy \
    --wasm "$WASM_DIR/option_market.wasm" \
    --source "$SOURCE" \
    --network "$NETWORK")
echo "   OptionMarket: $MARKET_ID"

# ── Save to JSON ───────────────────────────────────────────────────────────────
cat > .deployed.json <<EOF
{
  "network": "$NETWORK",
  "pricingEngine": "$PRICING_ID",
  "vault": "$VAULT_ID",
  "optionMarket": "$MARKET_ID",
  "oracle": "$REFLECTOR_ORACLE_ID",
  "usdcToken": "$USDC_ID",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo ""
echo "======================================================"
echo "✅ Deployment complete!"
echo "   Contract IDs saved to .deployed.json"
echo ""
echo "   Verify on Stellar Expert:"
echo "   https://stellar.expert/explorer/testnet/contract/$PRICING_ID"
echo "   https://stellar.expert/explorer/testnet/contract/$VAULT_ID"
echo "   https://stellar.expert/explorer/testnet/contract/$MARKET_ID"
echo ""
echo "▶  Next step: ./scripts/initialize.sh"
echo "======================================================"
