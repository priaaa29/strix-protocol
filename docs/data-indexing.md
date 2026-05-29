# Strix Protocol — Data Indexing

This document describes how on-chain events are indexed off-chain so the frontend can serve fast queries that would be prohibitively expensive against the RPC directly.

---

## Why index?

The Strix frontend needs answers to queries the Soroban RPC cannot serve cheaply:

- "What positions does wallet `G…` hold?" — requires scanning every `BUY_CALL`/`BUY_PUT` event ever emitted by `OptionMarket`.
- "What was the protocol's TVL over the last 7 days?" — requires aggregating `DEPOSIT`/`WITHDRAW` events plus settlement payouts over time.
- "Show me the options chain for next Friday." — would otherwise require N simulated RPC calls per page load.

The indexer turns these from O(chain history) reads into O(1) SQLite queries.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Soroban RPC (Stellar testnet)                 │
│                  https://soroban-testnet.stellar.org         │
└───────────────────────┬──────────────────────────────────────┘
                        │ getEvents() — polled every 30s
                        │
┌───────────────────────▼──────────────────────────────────────┐
│      backend/src/indexer/eventListener.ts                    │
│   - Tracks last indexed ledger (resume on restart)           │
│   - Filters events by contract ID (Vault, Market, Pricing)   │
│   - Parses topics → event_type, value → user_address         │
└───────────────────────┬──────────────────────────────────────┘
                        │ insertEvent()
                        │
┌───────────────────────▼──────────────────────────────────────┐
│              SQLite (backend/data/strix.db)                  │
│   - events     (ledger, contract, type, user, value, time)   │
│   - feedback   (user-submitted feedback rows)                │
│   - *_cache    (denormalised hot reads — vault, chain)       │
└───────────────────────┬──────────────────────────────────────┘
                        │ SELECT … indexed by user, type, time
                        │
┌───────────────────────▼──────────────────────────────────────┐
│         Express REST API (backend/src/api/)                  │
│   /api/vault/stats    /api/options/chain                     │
│   /api/positions/:a   /api/options/expiries                  │
│   /api/feedback                                              │
└───────────────────────┬──────────────────────────────────────┘
                        │ JSON
                        │
┌───────────────────────▼──────────────────────────────────────┐
│              Next.js frontend (Vercel)                       │
└──────────────────────────────────────────────────────────────┘
```

## Source code

| Concern | File |
|---------|------|
| Event polling loop | [`backend/src/indexer/eventListener.ts`](../backend/src/indexer/eventListener.ts) |
| SQLite schema + helpers | [`backend/src/indexer/db.ts`](../backend/src/indexer/db.ts) |
| REST endpoints | [`backend/src/api/`](../backend/src/api/) |
| Entry point | [`backend/src/index.ts`](../backend/src/index.ts) |

## Schema

```sql
CREATE TABLE events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ledger       INTEGER NOT NULL,
  contract_id  TEXT    NOT NULL,
  event_type   TEXT    NOT NULL,  -- BUY_CALL, DEPOSIT, SETTLE, …
  user_address TEXT,              -- nullable for protocol-level events
  value        TEXT,              -- JSON-encoded event data
  block_time   INTEGER NOT NULL,
  tx_hash      TEXT    NOT NULL
);

CREATE INDEX idx_events_user        ON events(user_address);
CREATE INDEX idx_events_type        ON events(event_type);
CREATE INDEX idx_events_block_time  ON events(block_time);
```

The three secondary indices make the three most common queries — by user, by type, by time-range — sub-millisecond on the SQLite side.

## Event types indexed

Sourced from `EVENT_TOPIC_MAP` in [`eventListener.ts`](../backend/src/indexer/eventListener.ts):

| Topic | Stored as | Emitted by |
|-------|-----------|------------|
| `deposit` | `DEPOSIT` | UnderwritingVault |
| `withdraw` | `WITHDRAW` | UnderwritingVault |
| `lock_capital` | `LOCK_CAPITAL` | UnderwritingVault |
| `release_capital` | `RELEASE_CAPITAL` | UnderwritingVault |
| `receive_premium` | `RECEIVE_PREMIUM` | UnderwritingVault |
| `pay_settlement` | `PAY_SETTLEMENT` | UnderwritingVault |
| `buy_call` | `BUY_CALL` | OptionMarket |
| `buy_put` | `BUY_PUT` | OptionMarket |
| `settle` | `SETTLE` | OptionMarket |
| `claim` | `CLAIM` | OptionMarket |
| `set_iv` | `SET_IV` | PricingEngine |
| `initialized` | `INITIALIZED` | All three |

## REST endpoints

The indexer powers these public read endpoints:

| Endpoint | Backed by | Description |
|----------|-----------|-------------|
| `GET /api/vault/stats` | `vault_stats_cache` + events | TVL, total shares, locked/available capital, share price |
| `GET /api/options/chain?expiry=…` | `options_chain_cache` + live PricingEngine sim | All 9 strikes + live call/put premiums |
| `GET /api/options/expiries` | Static (next 4 Fridays) | Upcoming weekly expiries |
| `GET /api/positions/:address` | `events WHERE user_address = ?` | All historical positions for a wallet |
| `GET /api/feedback` (POST) | `feedback` table | In-app feedback submission |

Full API reference: [`docs/api.md`](api.md).

## Resume safety

The indexer persists the last indexed ledger after each successful insert. On restart it resumes from `last_indexed_ledger + 1`, so events emitted while the indexer was offline are backfilled on the next poll.

If the indexer falls more than the RPC's `eventsRetentionWindow` behind (currently 17 280 ledgers ≈ 24h on testnet), older events are dropped by the RPC and cannot be backfilled. In that scenario, vault stats are reconstructed from the on-chain `get_vault_info()` view; per-user positions older than the window have to be re-fetched directly via `get_user_positions()` from the contract.

## Why not a managed indexer (Mercury, Subquery, Goldsky)?

Considered, deferred to Phase 3:

| Option | Why not now |
|--------|-------------|
| Mercury / Hyperion | Adds an external dependency for a workload SQLite handles fine at our scale. Free tiers exist but ops overhead isn't justified at <1k events/day. |
| Subquery | Full-text SDK; overkill for 12 event types and a single table. |
| Goldsky | EVM-first, Soroban support is still limited at the time of writing. |
| Custom on-chain "indexer" contract | Wastes contract storage and gas for what's effectively a read-side cache. |

The current SQLite + Express setup is intentionally minimal — it stays under 1000 lines and is debuggable by reading the source.

## Operational characteristics

- **Polling cadence**: 30 seconds. Matches the typical Soroban event finalization window.
- **DB size at 10k events**: ~5 MB. Linear growth.
- **Cold start lag**: ≤ 30 s after backend boots before the first events appear.
- **API latency** (95th percentile, local): `<10 ms` for indexed queries; `~200–800 ms` for live PricingEngine simulations passed through the chain endpoint.
