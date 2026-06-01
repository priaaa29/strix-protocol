# Strix Protocol — Security Checklist

Status as of submission. Items are rated:

- ✅ **Done** — implemented and verified
- ⚠️ **Mitigated** — known risk, accepted with rationale
- ❌ **Open** — tracked for next phase

Audit performed against [OWASP Top 10 for Smart Contracts](https://owasp.org/www-project-smart-contract-top-10/) (2023 edition), the [Soroban security guidelines](https://developers.stellar.org/docs/build/smart-contracts/example-contracts/auth), and our own threat model.

---

## Soroban-specific

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| S1 | All state-mutating entry points call `require_auth()` on the user address | ✅ | `option-market/src/lib.rs:226,334,434,537` (buy_call, buy_put, settle, claim) and `underwriting-vault/src/lib.rs` deposit/withdraw |
| S2 | Cross-contract calls between Vault ↔ OptionMarket require admin-only initialization wiring | ✅ | `option-market/src/lib.rs:86` (`initialize`) records authorized vault address; `set_pricing_engine`/`set_vault` are admin-gated |
| S3 | `Vec`/`Map` storage keys are namespaced by `DataKey` enum to prevent collision | ✅ | `option-market/src/types.rs`, `underwriting-vault/src/types.rs` |
| S4 | Persistent storage TTL is extended on writes to prevent eviction | ✅ | `extend_ttl(&key, 100_000, 1_000_000)` on every persistent write in `option-market/src/lib.rs:206` |
| S5 | No floating-point arithmetic anywhere in contracts | ✅ | Pure i128 fixed-point, 7-decimal scale. Verified by 32 pricing tests against Python scipy reference (±0.2%) |
| S6 | No `unwrap()` / `expect()` on user-controlled input | ✅ | Inputs validated with explicit `panic!("…")` before unwrap on storage reads; reviewed via `cargo clippy` |

## Authorization & access control

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| A1 | Admin-only functions check `admin == config.admin` before running | ✅ | `create_epoch`, `set_iv`, `set_spread`, `set_paused`, `set_pricing_engine` all gate on `config.admin` |
| A2 | Position claim verifies position owner matches caller | ✅ | `option-market/src/lib.rs:537` (`claim`) checks `pos.owner == owner` after `owner.require_auth()` |
| A3 | Vault deposit/withdraw require the depositor's signature, not just any signer | ✅ | `depositor.require_auth()` enforced before USDC `transfer_from` |
| A4 | Settlement is permissionless (any user can trigger after expiry) — intentional design | ✅ | Documented in `docs/api.md`; reduces admin liveness dependency |

## Economic / oracle attacks

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| E1 | Oracle price freshness check before use in pricing | ✅ | `pricing-engine/src/lib.rs` rejects `OracleValue` with stale `timestamp` (>1h old) |
| E2 | Oracle returns 0 / negative → contract panics, never quotes premium | ✅ | `if spot <= 0 { panic!("invalid spot price") }` in `create_epoch` |
| E3 | Settlement price locked at first `settle()` call — replay-safe | ✅ | `option-market/src/lib.rs:434` writes `SettlementInfo` once; re-call panics with "already settled" |
| E4 | Vault capacity check before locking collateral | ✅ | `underwriting-vault/src/lib.rs` `lock_capital` reverts with "insufficient unlocked capital" |
| E5 | Premium > 0 enforced (no zero-cost options) | ✅ | `option-market/src/lib.rs:226` rejects with "zero premium" |
| E6 | DIA oracle is autonomous push oracle — no keeper dependency, no single point of failure | ✅ | Migrated off MockOracle in commit `[oracle migration]`; documented in `docs/deployment.md` |

## Integer arithmetic

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| I1 | All arithmetic on i128 with explicit bounds checks where overflow possible | ✅ | Black-Scholes intermediate values bounded by spot × strike × √T; tested with extreme inputs |
| I2 | Division-before-multiplication avoided to preserve precision | ✅ | Reviewed manually in `black_scholes.rs`; tests cover 0.01 / 1 / 100 / 10_000 spot values |
| I3 | Share-price math handles edge cases (0 total shares, 0 TVL) | ✅ | `underwriting-vault/src/lib.rs` initial deposit mints 1:1; tested in `tests/` |

## Front-end / RPC

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| F1 | Frontend never holds private keys — all signing via wallet | ✅ | Uses `@creit.tech/stellar-wallets-kit` only; no `Keypair.fromSecret` anywhere in `frontend/`. (Repo-wide key hygiene: see M4 below; testnet keys outside the frontend bundle are documented as compromised.) |
| F2 | RPC endpoint validated as HTTPS-only | ✅ | `getRpcServer()` constructed with `{ allowHttp: false }` |
| F3 | Network passphrase explicitly set on every transaction | ✅ | `getNetworkPassphrase()` passed to every `TransactionBuilder` |
| F4 | XDR errors decoded gracefully — user sees readable error, not stack trace | ✅ | `parseContractError()` in `lib/soroban.ts` maps known error patterns to human messages |
| F5 | localStorage only persists wallet address (not signed payloads or secrets) | ✅ | `useWallet.ts:31` writes only the public key |

## Operational

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| O1 | `.env` and `.deployed.json` patterns gitignored | ✅ | `.gitignore` excludes `*.env*` and `scripts/.onboarded-secrets.json` |
| O2 | Deployment script idempotent (rerun-safe) | ✅ | `scripts/deploy.sh` skips already-deployed contracts |
| O3 | Pause switch exists for emergency stop | ✅ | `option-market/set_paused(admin, true)` halts new buys without affecting settle/claim |
| O4 | Test coverage includes adversarial scenarios | ✅ | 92 tests across pricing/vault/market + 8 integration tests; includes "buyer not authorized," "stale oracle," "already settled" |

## Known mitigated risks

| # | Risk | Mitigation | Rationale |
|---|------|------------|-----------|
| M1 | Single admin key controls IV, spread, pause | Admin key held in cold storage for production; testnet uses standard CLI keypair | Multi-sig for admin is a Phase-3 roadmap item (see README "Roadmap") |
| M2 | Pricing engine has no IV surface (flat 80% IV) | Documented as "Phase 2: IV surface" in README | Flat IV is acceptable for MVP; reduces oracle surface area |
| M3 | No circuit breaker on oracle price (>±X% per block) | DIA is a reputable push oracle on Stellar testnet; testnet exploits don't have economic impact | Pre-mainnet hardening item |
| M4 | **Phase-1 wallet secrets exposed in git history** — `scripts/simulate-activity.js` (commit `9afc2b1`) committed the 6 secret seeds for the Phase-1 community-feedback wallets (`GCSM…LGSW`, `GBMN…PGP4`, `GCZL…V2C2`, `GCHP…HTL4`, `GCVE…H5PN`, `GAVR…PT4L`) inline | Secrets moved to gitignored `scripts/.phase1-secrets.json` in the current commit; security checklist updated; **these specific seeds MUST be treated as permanently compromised and rotated before any mainnet redeploy** | Testnet-only at present; no real funds at risk. Rotating would invalidate the on-chain history these wallets carry for the feedback xlsx, which is why the keys were not rotated for the testnet submission |

## Open items for next phase

| # | Item | Target |
|---|------|--------|
| OP1 | External audit | Pre-mainnet, before any real-value deployment |
| OP2 | Multi-sig for admin functions | Phase 3 advanced feature |
| OP3 | Circuit breaker on oracle deviation | Pre-mainnet |
| OP4 | Formal verification of Black-Scholes invariants (parity, monotonicity) | Phase 3 |
| OP5 | Bug bounty program | Pre-mainnet |

---

## Self-attestation

I attest that all items marked ✅ above are implemented in the commit at the time of submission and verified either by (a) the linked source file/line, (b) the corresponding unit test in the `tests/` modules of each contract crate, or (c) the integration test in `contracts/integration-tests/`.

— Built for the Stellar Journey to Mastery — Black Belt submission.
