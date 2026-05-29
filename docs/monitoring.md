# Strix Protocol — Monitoring

How we observe the running system. Four layers, each cheap, each catches a different failure mode.

---

## Layer 1 — Health endpoint

**Endpoint:** `GET /health` (also `/api/health` via redirect) on the backend.

Returns 200 if all three subsystems are healthy, 503 otherwise. Shape:

```json
{
  "status": "ok",
  "uptime_seconds": 4231,
  "timestamp": "2026-05-19T12:34:56.000Z",
  "checks": {
    "db": "ok",
    "rpc": "ok",
    "indexer": "ok"
  },
  "detail": {
    "latest_ledger": 1234567,
    "indexer_last_event_unix": 1716121200,
    "indexer_lag_seconds": 14
  }
}
```

The three checks:

| Check | Healthy when | Source |
|-------|--------------|--------|
| `db` | `SELECT 1` succeeds against the SQLite file | [`backend/src/index.ts:88`](../backend/src/index.ts) |
| `rpc` | `getLatestLedger()` against Soroban RPC succeeds | same |
| `indexer` | Last indexed event is within 5 minutes of now (or zero events yet at boot) | uses `getLastIndexedBlock()` from [`backend/src/indexer/db.ts`](../backend/src/indexer/db.ts) |

The endpoint is safe to expose publicly — no PII, no secrets, only operational status. Free Uptime Robot / Better Uptime tier can poll this every 5 min.

## Layer 2 — Vercel Analytics

Page-view + Core Web Vitals tracking for the Next.js frontend. Enabled in Vercel project settings → Analytics. No code change required.

What it catches:
- Page-load latency regressions on the deployed app
- Drop-offs from `/` → `/options` (funnel)
- Geographic distribution of traffic

Screenshot for submission: take from the Vercel project dashboard once the site has had some traffic. Drop into `Resources/monitoring-vercel.png` and link below.

## Layer 3 — Application errors

The frontend renders a friendly error boundary at `frontend/app/error.tsx` for any thrown exception. Errors are logged to the browser console with a `[Error boundary]` prefix so they show up in:

- DevTools Console (developer debugging)
- Vercel function logs (for server-side errors in route handlers)

For production hardening, the integration point for Sentry is a single drop-in at `frontend/app/layout.tsx` (root layout) — left intentionally out for now to avoid coupling the testnet build to a third-party SaaS DSN. Adding it is a one-line `import * as Sentry from '@sentry/nextjs'` + an init call, gated on `NEXT_PUBLIC_SENTRY_DSN` env var.

## Layer 4 — On-chain protocol metrics

The `/metrics` page in the Next.js app pulls live state from the deployed contracts every 30 seconds:

- TVL, locked, available, share price
- Total positions opened (`MarketConfig.next_position_id`)
- Current XLM spot from DIA oracle
- Market pause status
- Deployed contract addresses with Stellar Expert links

This is the user-facing operational dashboard. URL: https://strix-protocol.vercel.app/metrics.

Source: [`frontend/app/metrics/page.tsx`](../frontend/app/metrics/page.tsx) + aggregator at [`frontend/lib/soroban.ts`](../frontend/lib/soroban.ts) (`getProtocolMetrics`).

## Layer 5 — Background workers

Two long-running backend processes that don't have request lifecycles, so request-level monitoring doesn't see them:

| Worker | What it does | Where it logs |
|--------|--------------|---------------|
| `eventListener` | Polls Soroban RPC every 30s for new contract events, inserts into SQLite | `[Indexer]` prefix in stdout |
| `settlement-keeper` | Watches for expired epochs and calls `settle()` permissionlessly | `[Settlement]` prefix in stdout |

Both are wired to the `/health` indexer-freshness check. If `eventListener` is silently failing, indexer lag grows past 5 minutes and `/health` flips to 503.

`process.on('unhandledRejection')` ensures any unhandled promise rejection inside these workers crashes the process loudly rather than silently dropping. The hosting environment (PM2 / Docker restart policy / systemd) is responsible for restarting after crash.

## What to screenshot for submission

| Artifact | Where to capture | Save as |
|----------|------------------|---------|
| `/health` JSON response | curl the live endpoint or a deployed staging URL | `Resources/monitoring-health.png` |
| `/metrics` page | Browser screenshot at https://strix-protocol.vercel.app/metrics | `Resources/monitoring-metrics.png` |
| Vercel Analytics overview | Vercel dashboard → project → Analytics tab | `Resources/monitoring-vercel.png` |
| Stellar Expert OptionMarket page | https://stellar.expert/explorer/testnet/contract/CCTQ3LWSSVP3ZLAXNVLXB7DTYPGFGTQ4RHDEGDKV5OT4QNO77HPYCOYX | `Resources/monitoring-expert.png` |

Add the four to the README "Monitoring dashboard" submission row.

## What we explicitly don't do (yet)

- **Sentry** — DSN-gated; not committed in this submission to avoid leaking project keys. Drop-in is documented above.
- **Grafana / Prometheus** — over-engineered for current traffic; SQLite reads serve the same role for now.
- **PagerDuty / on-call rotation** — not appropriate for a testnet deployment with no real-value at risk.

These move into scope once the protocol is mainnet-bound.
