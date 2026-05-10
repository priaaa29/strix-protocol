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

# DIA oracle on Stellar testnet (no deployment needed — it's already live)
DIA_ORACLE_ID="CAEDPEZDRCEJCF73ASC5JGNKCIJDV2QJQSW6DJ6B74MYALBNKCJ5IFP4"
# Circle testnet USDC (SAC-wrapped)
USDC_ID="CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"

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

echo "📡 Using DIA oracle (testnet): $DIA_ORACLE_ID"
echo "💵 Using Circle USDC (testnet): $USDC_ID"
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
  "diaOracle": "$DIA_ORACLE_ID",
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
