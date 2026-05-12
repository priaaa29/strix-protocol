#!/bin/bash
# seed-vault.sh — Seed the vault with initial liquidity.
#
# Deposits 1,000 USDC from the admin account into the vault to provide
# initial liquidity for option trading.
#
# Prerequisites:
#   - Admin account has sufficient USDC balance
#   - initialize.sh has been run
#
# Usage: ./scripts/seed-vault.sh [amount_usdc]

set -euo pipefail

NETWORK="testnet"
SOURCE="priya"
SEED_AMOUNT_USDC="${1:-1000}"

if [ ! -f .deployed.json ]; then
    echo "❌ .deployed.json not found. Run deploy.sh first."
    exit 1
fi

VAULT_ID=$(jq -r '.vault' .deployed.json)
ADMIN_ADDR=$(stellar keys address "$SOURCE")
USDC_ID=$(jq -r '.usdcToken' .deployed.json)

# Convert USDC to 7-decimal
AMOUNT_7DEC=$(echo "$SEED_AMOUNT_USDC * 10000000" | bc)

echo "======================================================"
echo "   Seeding Vault with $SEED_AMOUNT_USDC USDC"
echo "======================================================"
echo "   Vault   : $VAULT_ID"
echo "   Admin   : $ADMIN_ADDR"
echo "   Amount  : $AMOUNT_7DEC (7-decimal)"
echo ""

# Check USDC balance first
echo "Checking USDC balance..."
stellar contract invoke \
    --id "$USDC_ID" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    -- balance \
    --id "$ADMIN_ADDR"

echo ""
echo "Depositing $SEED_AMOUNT_USDC USDC to vault..."
stellar contract invoke \
    --id "$VAULT_ID" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    -- deposit \
    --depositor "$ADMIN_ADDR" \
    --amount "$AMOUNT_7DEC"

echo ""
echo "Vault state after seeding:"
stellar contract invoke \
    --id "$VAULT_ID" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    -- get_vault_info

echo ""
echo "✅ Vault seeded with $SEED_AMOUNT_USDC USDC!"
echo "======================================================"
