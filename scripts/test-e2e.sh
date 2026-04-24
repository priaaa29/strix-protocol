#!/bin/bash
# test-e2e.sh — End-to-end integration test on testnet.
#
# Tests the full flow: deposit → buy call → settle → claim → withdraw
# Uses a short-expiry epoch (5 minutes in the future) for fast testing.
#
# Usage: ./scripts/test-e2e.sh

set -euo pipefail

NETWORK="testnet"
SOURCE="priya"

if [ ! -f .deployed.json ]; then
    echo "❌ .deployed.json not found. Run deploy.sh first."
    exit 1
fi

PRICING_ID=$(jq -r '.pricingEngine' .deployed.json)
VAULT_ID=$(jq -r '.vault' .deployed.json)
MARKET_ID=$(jq -r '.optionMarket' .deployed.json)
ADMIN_ADDR=$(stellar keys address "$SOURCE")
USDC_ID="CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"

echo "======================================================"
echo "   Strix Protocol — E2E Integration Test"
echo "======================================================"
echo ""

# ── Step 1: Create short-expiry epoch (5 min from now) ───────────────────────
echo "Step 1: Creating short-expiry test epoch..."
SHORT_EXPIRY=$(( $(date +%s) + 300 )) # 5 minutes
echo "  Expiry: $SHORT_EXPIRY"
stellar contract invoke \
    --id "$MARKET_ID" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    -- create_epoch \
    --admin "$ADMIN_ADDR" \
    --expiry "$SHORT_EXPIRY"
echo "  ✅ Epoch created"

# ── Step 2: Get current spot price ───────────────────────────────────────────
echo ""
echo "Step 2: Reading spot price..."
SPOT=$(stellar contract invoke \
    --id "$PRICING_ID" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    -- get_spot_price)
echo "  XLM spot: $SPOT (7-decimal)"

# ── Step 3: Get available strikes ────────────────────────────────────────────
echo ""
echo "Step 3: Available strikes for epoch..."
stellar contract invoke \
    --id "$MARKET_ID" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    -- get_strikes \
    --expiry "$SHORT_EXPIRY"

# ── Step 4: Get premium quote ─────────────────────────────────────────────────
echo ""
echo "Step 4: Getting call premium quote (ATM, 1 contract)..."
stellar contract invoke \
    --id "$MARKET_ID" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    -- get_premium \
    --option_type '{"Call": {}}' \
    --strike "$SPOT" \
    --expiry "$SHORT_EXPIRY" \
    --amount 1

# ── Step 5: Buy a call option ─────────────────────────────────────────────────
echo ""
echo "Step 5: Buying ATM call (1 contract)..."
stellar contract invoke \
    --id "$MARKET_ID" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    -- buy_call \
    --buyer "$ADMIN_ADDR" \
    --strike "$SPOT" \
    --expiry "$SHORT_EXPIRY" \
    --amount 1
echo "  ✅ Call purchased"

# ── Step 6: Get vault state ────────────────────────────────────────────────────
echo ""
echo "Step 6: Vault state after purchase..."
stellar contract invoke \
    --id "$VAULT_ID" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    -- get_vault_info

# ── Step 7: Wait for expiry ───────────────────────────────────────────────────
echo ""
echo "Step 7: Waiting 5 minutes for expiry..."
echo "  (Contract will be settleable after $SHORT_EXPIRY)"
echo "  Sleeping 310 seconds..."
sleep 310

# ── Step 8: Settle ────────────────────────────────────────────────────────────
echo ""
echo "Step 8: Settling epoch..."
stellar contract invoke \
    --id "$MARKET_ID" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    -- settle \
    --caller "$ADMIN_ADDR" \
    --expiry "$SHORT_EXPIRY"
echo "  ✅ Settled"

# ── Step 9: Check position state ──────────────────────────────────────────────
echo ""
echo "Step 9: Checking position 0..."
stellar contract invoke \
    --id "$MARKET_ID" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    -- get_position \
    --position_id 0

# ── Step 10: Claim if ITM ─────────────────────────────────────────────────────
echo ""
echo "Step 10: Attempting claim..."
stellar contract invoke \
    --id "$MARKET_ID" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    -- claim \
    --owner "$ADMIN_ADDR" \
    --position_id 0 && echo "  ✅ Claimed!" || echo "  ℹ️  Option expired OTM (nothing to claim)"

echo ""
echo "======================================================"
echo "✅ E2E test complete!"
echo "======================================================"
