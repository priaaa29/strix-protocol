# Strix Protocol — Testing Checklist

## Automated Tests (run before every deploy)

```bash
cd contracts && cargo test 2>&1 | grep "test result"
```

Expected:
```
test result: ok. 32 passed  # pricing-engine
test result: ok. 31 passed  # option-market
test result: ok. 17 passed  # underwriting-vault
test result: ok. 8 passed   # integration-tests
```

---

## Contract Unit Test Coverage

### PricingEngine (32 tests)

| Test | What it checks |
|------|----------------|
| `test_call_price_basic` | Call > 0 for ATM with non-zero IV |
| `test_put_price_basic` | Put > 0 for ATM with non-zero IV |
| `test_put_call_parity` | \|call - put - (S-K)\| < tolerance |
| `test_deep_itm_call` | Deep ITM ≈ intrinsic value |
| `test_deep_otm_call` | Deep OTM → MIN_PREMIUM floor |
| `test_higher_iv_increases_premium` | IV sensitivity |
| `test_longer_time_increases_premium` | Theta sensitivity |
| `test_premium_scaling_with_amount` | Linear scaling |
| `test_spread_increases_premium` | Spread adds to call, subtracts from put |
| `test_min_premium_floor` | Premium ≥ 100_000 (0.01 USDC) |
| `test_expired_option_zero_premium` | time_to_expiry = 0 → MIN_PREMIUM |
| `test_oracle_staleness` | >5min stale oracle → panic |
| `test_set_iv` | Admin can update IV |
| `test_set_spread` | Admin can update spread |
| `test_unauthorized_set_iv` | Non-admin → panic |
| `test_get_spot_price` | Returns oracle price |
| ... (16 more) | |

### UnderwritingVault (17 tests)

| Test | What it checks |
|------|----------------|
| `test_deposit_and_withdraw` | Full round-trip, exact USDC returned |
| `test_share_price_invariant_no_premium` | Share price stable without premium |
| `test_share_price_increases_with_premium` | receive_premium → share price up |
| `test_multiple_depositors` | Proportional shares |
| `test_max_tvl_enforced` | Deposit beyond max_tvl → panic |
| `test_lock_and_release` | lock_capital / release_capital round-trip |
| `test_pay_settlement` | Payout reduces TVL correctly |
| `test_withdraw_more_than_owned` | → panic |
| `test_withdraw_more_than_available` | Capital locked → panic |
| `test_access_control` | Non-market caller → panic on lock/release |
| ... (7 more) | |

### OptionMarket (31 tests)

| Test | What it checks |
|------|----------------|
| `test_buy_call` | Position created, vault locked |
| `test_buy_put` | Position created, vault locked |
| `test_settle_call_itm` | ITM payout calculated correctly |
| `test_settle_call_otm` | OTM → payout = 0, position.claimed = true |
| `test_claim_itm` | USDC transferred, position.claimed = true |
| `test_claim_already_claimed` | → panic "already claimed" |
| `test_create_epoch` | 9 strikes created at correct offsets |
| `test_get_strikes` | Returns correct strikes for expiry |
| `test_settle_before_expiry` | → panic "expiry has not passed" |
| `test_settle_twice` | → panic "already settled" |
| `test_not_owner_claim` | → panic "not position owner" |
| ... (20 more) | |

### Integration Tests (8 tests)

| Test | What it checks |
|------|----------------|
| `test_full_buy_settle_claim_call_itm` | Full lifecycle, real cross-contract calls |
| `test_full_buy_settle_claim_put_itm` | Put lifecycle |
| `test_otm_option_no_claim` | OTM → claimed auto-set, claim → panic |
| `test_vault_share_price_after_premium` | Premium accrual via real vault |
| `test_multiple_buyers_same_strike` | Multiple positions, independent settlement |
| `test_lp_cannot_withdraw_locked_capital` | Liquidity lock enforced end-to-end |
| `test_settle_releases_otm_capital` | OTM settle → capital released to vault |
| `test_pricing_engine_oracle_integration` | Oracle price flows into premium |

---

## Manual Testnet Checklist

Run after `./scripts/deploy.sh` + `./scripts/initialize.sh`.

### Backend

- [ ] `curl http://localhost:3001/health` → `{"status":"ok"}`
- [ ] `curl http://localhost:3001/api/vault/stats` → vault data or 503 (no liquidity yet)
- [ ] `curl http://localhost:3001/api/options/expiries` → 4 Friday timestamps
- [ ] Seed vault: `./scripts/seed-vault.sh 5000`
- [ ] `curl http://localhost:3001/api/vault/stats` → tvl ≈ 50_000_000_000

### Frontend — Wallet Connect

- [ ] Navigate to `http://localhost:3000`
- [ ] Click "Connect Freighter" — Freighter popup appears
- [ ] Approve connection — address displayed in header
- [ ] Refresh page — auto-reconnects from localStorage
- [ ] Wrong network (switch Freighter to mainnet) — error message shown
- [ ] Disconnect — address cleared

### Frontend — Vault Flow

- [ ] Navigate to `/vault`
- [ ] Vault stats displayed (TVL, share price, available)
- [ ] Enter deposit amount → preview shows estimated shares
- [ ] Submit deposit — Freighter signs → tx confirmed → shares updated
- [ ] Enter withdraw amount → preview shows estimated USDC
- [ ] Submit withdraw — Freighter signs → tx confirmed → USDC returned

### Frontend — Options Flow

- [ ] Navigate to `/options`
- [ ] Expiry selector shows next Friday
- [ ] Options chain table shows 9 strikes with call/put premiums
- [ ] Select a call strike → premium shown, buy button enabled
- [ ] Submit buy — Freighter signs → tx confirmed
- [ ] Navigate to `/positions` → new position appears

### Frontend — Settlement & Claim

- [ ] Wait for expiry (use `test-e2e.sh` for 5-min epoch)
- [ ] On `/positions` → settle button appears for expired positions
- [ ] Click settle → tx confirmed → position shows settled price
- [ ] ITM position: claim button appears → click → USDC received
- [ ] OTM position: claim button disabled / "expired worthless" message

### Frontend — Error States

- [ ] RPC unreachable → error banner, no crash
- [ ] Freighter rejected → "Transaction cancelled by user"
- [ ] Insufficient vault capital → correct error message
- [ ] Wrong strike → "invalid strike" error message

---

## Black-Scholes Validation

Run the Python validation script:

```bash
python3 scripts/validate_bs.py
```

Expected output:
```
Test 1 PASS: call=8.42 (scipy=8.42), diff=0.00%
Test 2 PASS: call=0.10 (scipy=0.10), diff=0.00%
Test 3 PASS: call=5.31 (scipy=5.32), diff=0.19%
Test 4 PASS: put=0.50 (scipy=0.50), diff=0.00%
Test 5 PASS: put=12.14 (scipy=12.13), diff=0.08%
Put-call parity: PASS (diff=0.000000)
All validations passed!
```

---

## Performance

| Operation | Expected latency |
|-----------|-----------------|
| `readContract` (simulation) | < 3s |
| `buildAndSubmitTx` (full flow) | 10–30s (includes polling) |
| Backend API response | < 200ms (cached) |
| Backend API response | < 5s (chain fetch) |

