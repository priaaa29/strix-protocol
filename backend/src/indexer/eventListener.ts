// Strix Protocol — Soroban event listener
// Polls the Stellar RPC every 30s for new contract events and indexes them to SQLite.

import { SorobanRpc } from '@stellar/stellar-sdk';
import { insertEvent, getLastIndexedBlock } from './db';
import type { DbEvent } from '../types';

const RPC_URL = process.env.RPC_URL || 'https://soroban-testnet.stellar.org';
const POLL_INTERVAL_MS = 30_000;

// Contract IDs from env (set after deployment)
const CONTRACT_IDS: Record<string, string> = {
  pricingEngine: process.env.PRICING_ENGINE_ID || '',
  vault: process.env.VAULT_ID || '',
  optionMarket: process.env.OPTION_MARKET_ID || '',
};

// Map topic symbols → event_type labels
const EVENT_TOPIC_MAP: Record<string, string> = {
  deposit: 'DEPOSIT',
  withdraw: 'WITHDRAW',
  lock_capital: 'LOCK_CAPITAL',
  release_capital: 'RELEASE_CAPITAL',
  receive_premium: 'RECEIVE_PREMIUM',
  pay_settlement: 'PAY_SETTLEMENT',
  buy_call: 'BUY_CALL',
  buy_put: 'BUY_PUT',
  settle: 'SETTLE',
  claim: 'CLAIM',
  set_iv: 'SET_IV',
  initialized: 'INITIALIZED',
};

let server: SorobanRpc.Server;
let pollingTimer: ReturnType<typeof setInterval> | null = null;
let lastLedger = 0;

function getServer(): SorobanRpc.Server {
  if (!server) {
    server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });
  }
  return server;
}

/** Derive a human-readable event_type from Soroban event topics. */
function parseEventType(topics: string[]): string {
  // Topics are XDR-encoded ScVals. The first topic is typically a Symbol
  // indicating the event name. We match against known patterns.
  for (const topic of topics) {
    for (const [keyword, label] of Object.entries(EVENT_TOPIC_MAP)) {
      if (topic.toLowerCase().includes(keyword)) {
        return label;
      }
    }
  }
  return 'UNKNOWN';
}

/** Extract user_address from event value JSON if present. */
function extractUserAddress(valueJson: unknown): string | null {
  if (!valueJson || typeof valueJson !== 'object') return null;
  const v = valueJson as Record<string, unknown>;
  // Common patterns: { user: "G...", buyer: "G...", owner: "G...", depositor: "G..." }
  const candidates = ['user', 'buyer', 'owner', 'depositor', 'withdrawer', 'caller'];
  for (const key of candidates) {
    const val = v[key];
    if (typeof val === 'string' && val.startsWith('G') && val.length === 56) {
      return val;
    }
  }
  return null;
}

/** Fetch and index all new events since last indexed ledger. */
async function pollEvents(): Promise<void> {
  const srv = getServer();
  const activeContracts = Object.values(CONTRACT_IDS).filter(Boolean);

  if (activeContracts.length === 0) {
    // No contracts deployed yet — skip silently
    return;
  }

  try {
    // getEvents requires a startLedger within the node's retention window.
    // If we haven't indexed anything yet, start from the current ledger
    // (we only care about events going forward, not historical replay).
    let startLedger = lastLedger;
    if (startLedger === 0) {
      const latest = await srv.getLatestLedger();
      startLedger = latest.sequence;
      lastLedger = startLedger;
    }

    const response = await srv.getEvents({
      startLedger,
      filters: [
        {
          type: 'contract',
          contractIds: activeContracts,
        },
      ],
      limit: 200,
    });

    if (!response || !response.events || response.events.length === 0) {
      return;
    }

    let maxLedger = lastLedger;

    for (const event of response.events) {
      const ledger = event.ledger;
      if (ledger > maxLedger) maxLedger = ledger;

      // Parse topics (array of XDR ScVal) — stringify for pattern matching
      const rawTopics = Array.isArray(event.topic) ? event.topic : [];
      const topics = rawTopics.map((t) => {
        try { return JSON.stringify(t); } catch { return String(t); }
      });
      const eventType = parseEventType(topics);

      // Parse value
      let valueData: unknown = null;
      try {
        if (event.value) {
          valueData = JSON.parse(JSON.stringify(event.value));
        }
      } catch {
        valueData = { raw: String(event.value) };
      }

      const userAddress = extractUserAddress(valueData);

      const dbEvent: Omit<DbEvent, 'id'> = {
        event_type: eventType,
        tx_hash: event.txHash ?? `${event.id}`,
        block_time: Math.floor(new Date(event.ledgerClosedAt ?? Date.now()).getTime() / 1000),
        user_address: userAddress,
        data: JSON.stringify({ topics, value: valueData, contractId: event.contractId, ledger }),
        indexed_at: Math.floor(Date.now() / 1000),
      };

      insertEvent(dbEvent);
    }

    if (maxLedger > lastLedger) {
      lastLedger = maxLedger;
      console.log(`[Indexer] Indexed up to ledger ${lastLedger} (${response.events.length} events)`);
    }
  } catch (err: unknown) {
    // Network errors are expected during testnet downtime — log and continue
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[Indexer] Poll failed: ${message}`);
  }
}

/** Start the event listener. Call once at server startup. */
export function startEventListener(): void {
  if (pollingTimer !== null) return; // Already running

  // Seed last ledger from DB so we don't re-index on restart
  const lastDbBlock = getLastIndexedBlock();
  if (lastDbBlock > 0) {
    lastLedger = lastDbBlock;
  }

  console.log(`[Indexer] Starting event listener (poll every ${POLL_INTERVAL_MS / 1000}s, from ledger ${lastLedger})`);

  // Poll immediately, then on interval
  void pollEvents();
  pollingTimer = setInterval(() => {
    void pollEvents();
  }, POLL_INTERVAL_MS);
}

/** Stop the event listener (for graceful shutdown). */
export function stopEventListener(): void {
  if (pollingTimer !== null) {
    clearInterval(pollingTimer);
    pollingTimer = null;
    console.log('[Indexer] Event listener stopped.');
  }
}
