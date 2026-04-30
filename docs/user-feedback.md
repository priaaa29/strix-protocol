# Strix Protocol — User Feedback Guide

## Overview

Strix collects feedback from testnet users via the in-app feedback form and the `/api/feedback` endpoint. This document covers the onboarding flow, feedback categories, and how to analyze results.

---

## User Onboarding Flow

### What testers need

1. **Freighter wallet** — install from [freighter.app](https://freighter.app)
2. **Testnet XLM** — fund via Friendbot: `https://friendbot.stellar.org/?addr=<address>`
3. **Testnet USDC** — coordinate with admin to receive test USDC (see `mint-test-usdc.sh`)
4. **Switch to testnet** — in Freighter: Settings → Network → Testnet

### Tester brief (share this)

> **Strix Protocol** is an options trading protocol built on Stellar. You can:
> - **Deposit USDC** into the vault to earn premiums as a liquidity provider
> - **Buy call/put options** on XLM at weekly strike prices
> - **Settle and claim** payouts after expiry
>
> This is a testnet build — all assets are test tokens with no real value.
> Please try all three flows and share your honest feedback.

---

## Feedback Categories

| Category | What to ask about |
|----------|--------------------|
| `ux` | Navigation clarity, button placement, loading states, error messages |
| `bug` | Anything broken — crashes, wrong numbers, failed transactions |
| `feature` | What's missing? What would make this more useful? |
| `other` | General impressions, comparison to other DeFi protocols |

---

## Collecting Feedback

### In-app (preferred)

The feedback form is accessible from every page footer. Users rate 1–5 and choose a category.

Their wallet address is auto-populated if connected (anonymous otherwise).

### Direct API

```bash
curl -X POST http://localhost:3001/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "user_address": "GABC...",
    "rating": 4,
    "category": "ux",
    "message": "The options chain table is clean. Wish I could filter by moneyness."
  }'
```

### Viewing all feedback

```bash
curl http://localhost:3001/api/feedback | jq '.feedback[]'
```

---

## Feedback Analysis Template

After collecting ≥ 5 responses, summarize with:

```
Total responses: N
Average rating: X.X / 5

By category:
  UX: N responses
  Bug: N responses  
  Feature: N responses
  Other: N responses

Top themes:
1. [Common praise]
2. [Common pain point]
3. [Most-requested feature]

Bugs to fix before mainnet:
- [ ] [bug description]

UX improvements:
- [ ] [improvement]
```

---

## Target Tester Personas

1. **DeFi native** — familiar with Uniswap/dYdX, first time on Stellar. Focus: compare UX, missing features.
2. **Stellar OG** — knows Stellar but new to options. Focus: onboarding clarity, options education.
3. **Options trader** — knows Black-Scholes, skeptical of on-chain pricing. Focus: pricing accuracy, strike selection.
4. **LP / yield seeker** — primarily interested in vault returns. Focus: APY visibility, risk disclosure.
5. **Non-technical** — general crypto user. Focus: can they complete a flow without help?

---

## Feedback Submission Checklist

- [ ] ≥ 5 unique testers submitted feedback
- [ ] At least 1 bug report documented
- [ ] At least 3 UX improvement ideas recorded
- [ ] Average rating ≥ 3.5
- [ ] All reported bugs triaged (fixed or documented as known issue)
