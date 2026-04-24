#!/bin/bash
# mint-test-usdc.sh — Helper to acquire testnet USDC.
#
# On testnet, you can use the Stellar Laboratory to get test USDC from the
# SAC issuer, or use this script which interacts with the testnet USDC issuer.
#
# Usage:
#   ./scripts/mint-test-usdc.sh <recipient_address> <amount_usdc>
#   ./scripts/mint-test-usdc.sh GCABC... 1000

set -euo pipefail

NETWORK="testnet"
HORIZON_URL="https://horizon-testnet.stellar.org"

RECIPIENT="${1:-}"
AMOUNT="${2:-1000}"

if [ -z "$RECIPIENT" ]; then
    echo "Usage: $0 <recipient_address> [amount_usdc]"
    echo ""
    echo "To get testnet USDC manually:"
    echo "  1. Get testnet XLM from Friendbot: https://friendbot.stellar.org/?addr=<your_address>"
    echo "  2. Use Stellar Laboratory to establish a USDC trustline and receive USDC"
    echo "  3. Or use the USDC testnet faucet at: https://stellar.expert/explorer/testnet"
    exit 1
fi

echo "======================================================"
echo "   Strix Protocol — Testnet USDC Helper"
echo "======================================================"
echo ""
echo "ℹ️  Testnet USDC Information:"
echo "   Asset: USDC"
echo "   Issuer: Circle testnet issuer"
echo ""
echo "Steps to get testnet USDC:"
echo ""
echo "1. Fund account with testnet XLM (Friendbot):"
echo "   curl 'https://friendbot.stellar.org/?addr=$RECIPIENT'"
echo ""
echo "2. The testnet USDC contract (SAC) is pre-deployed."
echo "   Contract ID: CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
echo ""
echo "3. If you have the USDC issuer key, mint with:"
echo "   stellar contract invoke --id <USDC_CONTRACT> -- mint --to $RECIPIENT --amount <7-decimal-amount>"
echo ""
echo "For testing purposes, use the admin key to mint test USDC:"
echo "   stellar contract invoke \\"
echo "     --id CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA \\"
echo "     --source <usdc_admin_key> \\"
echo "     --network testnet \\"
echo "     -- mint --to $RECIPIENT --amount $((AMOUNT * 10000000))"
echo ""
echo "======================================================"

# Try to fund with Friendbot (XLM)
echo "Funding $RECIPIENT with testnet XLM via Friendbot..."
curl -s "https://friendbot.stellar.org/?addr=$RECIPIENT" | jq '.hash' 2>/dev/null || \
    echo "(Friendbot request sent)"
echo ""
echo "✅ XLM funded. Get USDC via Stellar Laboratory or the steps above."
