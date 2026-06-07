# Audit Response — Issue #1

This document is the formal response to the technical review filed in [issue #1](https://github.com/priaaa29/strix-protocol/issues/1). It accompanies the docs-only pull request that closes that issue.

The audit reported **30 findings** across critical, high, medium, and low severities. All 30 are addressed across **10 fix commits** + **1 redeploy commit**, plus a follow-up **recheck polish** commit and a **new-tests** commit shipped in response to an independent recheck. Every commit listed below is already on `main`; this PR's only artifact is this response document.

---

## Headline numbers

| Metric | Pre-audit | Post-audit |
|---|---|---|
| Critical findings open | 7 | 0 |
| High findings open | 10 | 0 |
| Medium findings open | 8 | 0 |
| Low findings open | 5 | 0 |
| Contract tests | 88 | **101** |
| Frontend / backend type errors | 0 | 0 |
| Live demo URL | `strix-protocol.vercel.app` | `strix-protocol.vercel.app` *(same; redeployed contracts behind new IDs)* |

`cargo test` summary: **8 integration + 36 option-market + 37 pricing-engine + 20 underwriting-vault = 101 passing.**

---

## Fix matrix

Every audit finding maps to one or more commits. All commit hashes are clickable.

### 🔴 Critical (7 of 7 fixed)

| # | Finding | Commits |
|---|---|---|
| 1 | Sponsor balance check no-op (returned `Infinity`) | [`7452836`](https://github.com/priaaa29/strix-protocol/commit/7452836) |
| 2 | Sponsor rate-limit trivially bypassable | [`7452836`](https://github.com/priaaa29/strix-protocol/commit/7452836) |
| 3 | Six Stellar secret keys committed in `scripts/simulate-activity.js` | [`7452836`](https://github.com/priaaa29/strix-protocol/commit/7452836) |
| 4 | Call options under-collateralized; payouts silently capped | [`fcc8d5c`](https://github.com/priaaa29/strix-protocol/commit/fcc8d5c) + [`2dc54d1`](https://github.com/priaaa29/strix-protocol/commit/2dc54d1) *(tests)* |
| 5 | Indexer cursor stores timestamp where ledger sequence expected | [`b76f6c9`](https://github.com/priaaa29/strix-protocol/commit/b76f6c9) |
| 6 | Settlement-keeper hour mismatch (08:00 vs 16:00 UTC drift) | [`81fc44f`](https://github.com/priaaa29/strix-protocol/commit/81fc44f) + [`f147275`](https://github.com/priaaa29/strix-protocol/commit/f147275) *(display strings)* |
| 7 | Flagship sponsored buy never showed "confirmed" | [`bce2e68`](https://github.com/priaaa29/strix-protocol/commit/bce2e68) + [`f147275`](https://github.com/priaaa29/strix-protocol/commit/f147275) *(deposit/withdraw/claim)* |

### 🟠 High (10 of 10 fixed)

| # | Finding | Commits |
|---|---|---|
| 8 | `settle()` keeper re-entrancy guard missing | [`81fc44f`](https://github.com/priaaa29/strix-protocol/commit/81fc44f) |
| 9 | "DIA" vs "Reflector" inconsistency, 3 different oracle IDs | [`f2a2c9c`](https://github.com/priaaa29/strix-protocol/commit/f2a2c9c) + [`f147275`](https://github.com/priaaa29/strix-protocol/commit/f147275) |
| 10 | Settlement uses current oracle price, not expiry-window price | [`fcc8d5c`](https://github.com/priaaa29/strix-protocol/commit/fcc8d5c) + [`2dc54d1`](https://github.com/priaaa29/strix-protocol/commit/2dc54d1) *(tests)* |
| 11 | Withdraw "max" mixes share units and USDC units | [`bce2e68`](https://github.com/priaaa29/strix-protocol/commit/bce2e68) |
| 12 | No wallet network-mismatch guard | [`f2a2c9c`](https://github.com/priaaa29/strix-protocol/commit/f2a2c9c) |
| 13 | `unhandledRejection` exits the whole backend | [`b76f6c9`](https://github.com/priaaa29/strix-protocol/commit/b76f6c9) |
| 14 | No RPC backoff / retry anywhere | [`8f8926f`](https://github.com/priaaa29/strix-protocol/commit/8f8926f) |
| 15 | `getUserPositions` is a sequential N+1 RPC waterfall | [`bce2e68`](https://github.com/priaaa29/strix-protocol/commit/bce2e68) |
| 16 | Fabricated "Est. APY" + overpromised auto-settlement copy | [`bce2e68`](https://github.com/priaaa29/strix-protocol/commit/bce2e68) + [`f147275`](https://github.com/priaaa29/strix-protocol/commit/f147275) *(dead code removed)* |
| 17 | Phase-2 wallets labeled as "onboarded users" without qualifier | [`f2a2c9c`](https://github.com/priaaa29/strix-protocol/commit/f2a2c9c) + [`f147275`](https://github.com/priaaa29/strix-protocol/commit/f147275) *(metrics page KPI)* |

### 🟡 Medium (8 of 8 fixed)

| # | Finding | Commits |
|---|---|---|
| 18 | Broken re-init guard in OptionMarket | [`fcc8d5c`](https://github.com/priaaa29/strix-protocol/commit/fcc8d5c) |
| 19 | `set_option_market` is mutable forever | [`fcc8d5c`](https://github.com/priaaa29/strix-protocol/commit/fcc8d5c) + [`2dc54d1`](https://github.com/priaaa29/strix-protocol/commit/2dc54d1) *(tests)* |
| 20 | PricingEngine panics on `strike == 0` | [`fcc8d5c`](https://github.com/priaaa29/strix-protocol/commit/fcc8d5c) + [`2dc54d1`](https://github.com/priaaa29/strix-protocol/commit/2dc54d1) *(tests)* |
| 21 | `exp()` positive-range overflow latent | [`fcc8d5c`](https://github.com/priaaa29/strix-protocol/commit/fcc8d5c) |
| 22 | Indexer dedup key drops multi-event txs | [`b76f6c9`](https://github.com/priaaa29/strix-protocol/commit/b76f6c9) |
| 23 | Indexer cursor re-fetches a ledger / loses >200 events | [`b76f6c9`](https://github.com/priaaa29/strix-protocol/commit/b76f6c9) |
| 24 | Fragile event-type parsing via XDR substring `includes()` | [`b76f6c9`](https://github.com/priaaa29/strix-protocol/commit/b76f6c9) |
| 25 | Rate limiter has no `trust proxy` | [`b76f6c9`](https://github.com/priaaa29/strix-protocol/commit/b76f6c9) |

### ⚪ Low / Nits (5 of 5 fixed)

| # | Finding | Commits |
|---|---|---|
| 26 | `/health` reports stale on a quiet testnet | [`b76f6c9`](https://github.com/priaaa29/strix-protocol/commit/b76f6c9) |
| 27 | Sponsored buy consumes rate-limit slot on PENDING | [`7452836`](https://github.com/priaaa29/strix-protocol/commit/7452836) |
| 28 | No slippage / max-premium guard on buys | [`f2a2c9c`](https://github.com/priaaa29/strix-protocol/commit/f2a2c9c) |
| 29 | Backend `stellar-sdk` two majors behind frontend | [`b76f6c9`](https://github.com/priaaa29/strix-protocol/commit/b76f6c9) |
| 30 | Dead UI items (toast, settle status, confirming state) | [`8f8926f`](https://github.com/priaaa29/strix-protocol/commit/8f8926f) + [`f147275`](https://github.com/priaaa29/strix-protocol/commit/f147275) *(deposit/withdraw/claim plumbing)* |

---

## The 10 fix commits, in order

1. [`bce2e68`](https://github.com/priaaa29/strix-protocol/commit/bce2e68) `fix(frontend): tx progress + withdraw units + drop fabricated APY` — closes **#7, #11, #15, #16**
2. [`7452836`](https://github.com/priaaa29/strix-protocol/commit/7452836) `fix(security): real sponsor balance check, global cap, secrets out of repo` — closes **#1, #2, #3, #27**
3. [`81fc44f`](https://github.com/priaaa29/strix-protocol/commit/81fc44f) `fix(expiry): unify Friday hour across frontend + backend + add keeper guards` — closes **#6, #8**
4. [`b76f6c9`](https://github.com/priaaa29/strix-protocol/commit/b76f6c9) `fix(backend): SDK 14 + indexer cursor + resilient shutdown + correct /health` — closes **#5, #13, #22, #23, #24, #25, #26, #29**
5. [`f2a2c9c`](https://github.com/priaaa29/strix-protocol/commit/f2a2c9c) `fix: align oracle name to Reflector, label Phase-2 seeded, network guard, live premium` — closes **#9, #12, #17, #28**
6. [`8f8926f`](https://github.com/priaaa29/strix-protocol/commit/8f8926f) `fix: RPC retry/backoff + wire settle TransactionStatus + drop dead toast` — closes **#14, #30**
7. [`fcc8d5c`](https://github.com/priaaa29/strix-protocol/commit/fcc8d5c) `fix(contracts): collateral cap disclosure, settle-price window, init/strike/exp guards` — closes **#4, #10, #18, #19, #20, #21**
8. [`efe5418`](https://github.com/priaaa29/strix-protocol/commit/efe5418) `chore(deploy): point README + monitoring docs at the post-audit testnet contracts` — completes the chain by redeploying all three Soroban contracts to new addresses
9. [`f147275`](https://github.com/priaaa29/strix-protocol/commit/f147275) `polish: close the recheck cosmetic gaps (08:00 UTC, Reflector, progress, dead code)` — addresses lingering display strings, the `mock-oracle` orphan crate, the dead `oracle-keeper.ts`, the `estimateApy` orphan, and wires the progress callback through `deposit` / `withdraw` / `claim`
10. [`2dc54d1`](https://github.com/priaaa29/strix-protocol/commit/2dc54d1) `test: cover the audit-introduced contract behaviors (88 → 101 tests)` — adds 13 Rust tests for PAYCAP emission, settle-window panics, set-once `set_option_market`, strike/amount input validation

---

## Post-audit contract redeploy (testnet)

After landing the contract-level fixes (commit `fcc8d5c`), all three Soroban contracts were redeployed with new addresses:

| Contract | Address |
|---|---|
| PricingEngine | [`CBKM4QJRSKF2BRDXNB7CYFDNVEOGBXHWEKXWARN2RNDIIRUIHSWLZCVO`](https://stellar.expert/explorer/testnet/contract/CBKM4QJRSKF2BRDXNB7CYFDNVEOGBXHWEKXWARN2RNDIIRUIHSWLZCVO) |
| UnderwritingVault | [`CB7DAMXGUSP24UK5IBYVHAJBC7JVJMNTOA4AX6EVJYR7COQI2HPP4AB6`](https://stellar.expert/explorer/testnet/contract/CB7DAMXGUSP24UK5IBYVHAJBC7JVJMNTOA4AX6EVJYR7COQI2HPP4AB6) |
| OptionMarket | [`CAMRJSRD7S2NW6APYRB3QHDTBOEHY7OMZCPAW3C4I7H55EOQG2QEWPXP`](https://stellar.expert/explorer/testnet/contract/CAMRJSRD7S2NW6APYRB3QHDTBOEHY7OMZCPAW3C4I7H55EOQG2QEWPXP) |
| Reflector Oracle (unchanged) | [`CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63`](https://stellar.expert/explorer/testnet/contract/CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63) |
| Circle testnet USDC SAC (unchanged) | [`CBA4XQJCNN76UX3AQ63EKQXQMMIHTVENTXV2QNXLCOPMYIXAESQZUDZQ`](https://stellar.expert/explorer/testnet/contract/CBA4XQJCNN76UX3AQ63EKQXQMMIHTVENTXV2QNXLCOPMYIXAESQZUDZQ) |

Vault re-seeded with 5,000 USDC; next-Friday epoch created with 9 strikes around current XLM spot. Smoke-tested:

- `vault.get_vault_info` → TVL 5,000 USDC, share price 1.00
- `pricing-engine.get_spot_price` → live Reflector quote
- `option-market.get_strikes(<friday>)` → 9 strikes

---

## Items intentionally not fixed in this cycle (documented)

The audit's three lowest-priority architectural items remain open as Phase-3 roadmap. The team's reasoning is in each row:

| # | Item | Why deferred | Where tracked |
|---|---|---|---|
| N2 | Contract-level `settle()` batching (no `max_count` / cursor) | Today positions-per-expiry is in the low double digits, well under any Soroban budget concern. Adding storage-cursor complexity carries redeploy risk + new attack surface; better to ship batching when traffic actually demands it. | README "Roadmap — Next Phase" |
| N3 | UI cap label assumes `contract_size == SCALE` | Only diverges if `contract_size` is ever changed at deploy time. We have no plans to change it on this testnet build. | Comment in `BuyOptionModal.tsx` |
| N9–N11 | Sponsor edge cases (concurrent-pop race, no inner-tx pre-simulation, non-constant-time admin auth) | All testnet-only, bounded blast radius (≤ 0.025 XLM/day per the sponsor balance check). Each is documented inline with severity rationale. | Inline comments in `frontend/app/api/sponsor/route.ts` and `backend/src/api/feedback.ts` |

These were called out by an independent recheck of the audit-fix work; the recheck report (verbatim, including what's deferred and why) is preserved in [`docs/security-checklist.md`](docs/security-checklist.md) and the "Known mitigated risks" section of that file.

---

## Reproducing the fix

```bash
# 1. Verify the test suite
cd contracts && cargo test 2>&1 | grep "test result"
# Expect: 8 / 36 / 37 / 20 / 0 pass = 101 passing across 4 crates

# 2. Verify frontend builds
cd frontend && npx tsc --noEmit && npm run build

# 3. Verify backend type-checks
cd backend && npx tsc --noEmit

# 4. Smoke-test the redeployed contracts
stellar contract invoke --id CB7DAMXGUSP24UK5IBYVHAJBC7JVJMNTOA4AX6EVJYR7COQI2HPP4AB6 \
  --source priya --network testnet -- get_vault_info

stellar contract invoke --id CBKM4QJRSKF2BRDXNB7CYFDNVEOGBXHWEKXWARN2RNDIIRUIHSWLZCVO \
  --source priya --network testnet -- get_spot_price
```

---

## Acknowledgements

Thank you for the thoroughness of the review — every finding was actionable and several (#4 silent payout truncation, #6 hour drift, #10 settle-window) were genuine correctness gaps that we would not have found otherwise on this submission cycle.

Closes #1.
