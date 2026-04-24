#!/bin/bash
# create-epoch.sh — Create the next Friday option epoch.
#
# Calculates the next Friday 08:00 UTC and creates an epoch with 9 strikes.
#
# Usage:
#   ./scripts/create-epoch.sh           # next Friday 08:00 UTC
#   ./scripts/create-epoch.sh 1234567890  # custom expiry timestamp

set -euo pipefail

NETWORK="testnet"
SOURCE="priya"

if [ ! -f .deployed.json ]; then
    echo "❌ .deployed.json not found. Run deploy.sh first."
    exit 1
fi

MARKET_ID=$(jq -r '.optionMarket' .deployed.json)
ADMIN_ADDR=$(stellar keys address "$SOURCE")

# ── Calculate next Friday 08:00 UTC ───────────────────────────────────────────
if [ -n "${1:-}" ]; then
    EXPIRY="$1"
    echo "Using custom expiry: $EXPIRY"
else
    # Day of week: 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    DOW=$(date -u +%u) # 1=Mon, 7=Sun (ISO)
    DAYS_UNTIL_FRI=$(( (5 - DOW + 7) % 7 ))
    if [ "$DAYS_UNTIL_FRI" -eq 0 ]; then
        DAYS_UNTIL_FRI=7  # Already Friday? → next Friday
    fi

    # Get today midnight UTC + days_until_fri days + 8 hours
    TODAY_MIDNIGHT=$(date -u -d "$(date -u +%Y-%m-%d) 00:00:00" +%s 2>/dev/null || \
                     date -u -j -f "%Y-%m-%d %H:%M:%S" "$(date -u +%Y-%m-%d) 00:00:00" +%s)
    EXPIRY=$(( TODAY_MIDNIGHT + DAYS_UNTIL_FRI * 86400 + 8 * 3600 ))
    echo "Next Friday 08:00 UTC: $EXPIRY ($(date -u -d @$EXPIRY 2>/dev/null || date -u -r $EXPIRY))"
fi

echo ""
echo "======================================================"
echo "   Creating Option Epoch"
echo "======================================================"
echo "   OptionMarket : $MARKET_ID"
echo "   Admin        : $ADMIN_ADDR"
echo "   Expiry       : $EXPIRY"
echo ""

stellar contract invoke \
    --id "$MARKET_ID" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    -- create_epoch \
    --admin "$ADMIN_ADDR" \
    --expiry "$EXPIRY"

echo ""
echo "✅ Epoch created!"
echo ""
echo "Strikes created:"
stellar contract invoke \
    --id "$MARKET_ID" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    -- get_strikes \
    --expiry "$EXPIRY"
echo ""
echo "======================================================"
