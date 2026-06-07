# Strix Protocol Backend API

Base URL: `http://localhost:3001` (or your deployed backend URL)

## Health

### `GET /health`
```json
{ "status": "ok", "timestamp": 1712345678 }
```

---

## Positions

### `GET /api/positions/:address`
Returns all indexed on-chain events for a Stellar address.

**Path params:** `address` — G-address (56 chars)

**Response:**
```json
{
  "address": "GABC...",
  "count": 3,
  "events": [
    {
      "id": 1,
      "event_type": "BUY_CALL",
      "tx_hash": "abc123...",
      "block_time": 1712345000,
      "user_address": "GABC...",
      "data": { "topics": [...], "value": {...} },
      "indexed_at": 1712345010
    }
  ]
}
```

### `GET /api/positions?limit=20&type=BUY_CALL`
Recent events across all users.

**Query params:**
- `limit` (1–100, default 20)
- `type` (BUY_CALL | BUY_PUT | SETTLE | CLAIM | DEPOSIT | WITHDRAW)

---

## Vault

### `GET /api/vault/stats`
Returns current vault state (cached 60s from chain).

**Response:**
```json
{
  "source": "chain",
  "cachedAt": 1712345678,
  "tvl": "50000000000",
  "totalShares": "50000000000",
  "locked": "12000000000",
  "available": "38000000000",
  "sharePrice": "10000000"
}
```

All values are 7-decimal fixed-point strings (divide by 10_000_000 for human-readable USDC).

`source` is one of: `"chain"` | `"cache"` | `"stale_cache"`

---

## Options

### `GET /api/options/chain?expiry=<unix_timestamp>`
Returns strikes and premiums for an expiry (cached 2 min from chain).

Defaults to next Friday 08:00 UTC if no expiry specified.

**Response:**
```json
{
  "source": "chain",
  "expiry": 1712880000,
  "cachedAt": 1712345678,
  "strikes": [
    {
      "strike": "1200000000",
      "expiry": 1712880000,
      "callPremium": "8500000",
      "putPremium": "6300000"
    }
  ]
}
```

### `GET /api/options/expiries`
Returns the next 4 weekly Friday expiry timestamps.

**Response:**
```json
{
  "expiries": [1712880000, 1713484800, 1714089600, 1714694400]
}
```

---

## Feedback

### `POST /api/feedback`
Submit user feedback.

**Body:**
```json
{
  "user_address": "GABC...",   // optional, Stellar G-address
  "rating": 4,                  // 1–5
  "category": "ux",             // ux | bug | feature | other
  "message": "Love the UI!"     // required, ≤ 2000 chars
}
```

**Response (201):**
```json
{ "success": true, "message": "Feedback submitted. Thank you!" }
```

### `GET /api/feedback`
Returns all submitted feedback.

```json
{
  "count": 12,
  "feedback": [
    {
      "id": 1,
      "user_address": "GABC...",
      "rating": 5,
      "category": "ux",
      "message": "Clean and fast!",
      "submitted_at": 1712345678
    }
  ]
}
```

---

## Error Format

All errors follow:
```json
{ "error": "Human-readable error message" }
```

HTTP status codes: `400` (bad request), `500` (server error), `503` (chain/RPC unavailable)
