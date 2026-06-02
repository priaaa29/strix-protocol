// Strix Protocol — Soroban event listener
// Polls the Stellar RPC every 30s for new contract events and indexes them to SQLite.

import { rpc, scValToNative } from '@stellar/stellar-sdk';
import { insertEvent, getLastIndexedLedger, setLastIndexedLedger } from './db';
import type { DbEvent } from '../types';
import { logger } from '../logger';

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

let server: rpc.Server;
let pollingTimer: ReturnType<typeof setInterval> | null = null;
let lastLedger = 0;
let lastPollAt = 0; // unix-seconds; updated on every poll attempt, success or not

/** Read by /health to detect a hung indexer regardless of trade volume. */
export function getLastPollAt(): number {
  return lastPollAt;
}

function getServer(): rpc.Server {
  if (!server) {
    server = new rpc.Server(RPC_URL, { allowHttp: false });
  }
  return server;
}

/** Derive a human-readable event_type from a list of already-decoded topic strings. */
function parseEventType(topics: string[]): string {
  for (const topic of topics) {
    const t = topic.toLowerCase();
    for (const [keyword, label] of Object.entries(EVENT_TOPIC_MAP)) {
      if (t === keyword || t.includes(keyword)) {
        return label;
      }
    }
  }
  return 'UNKNOWN';
}

/** Find a G-address inside a decoded ScVal-as-JS-object value. */
function extractUserAddress(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const candidates = ['user', 'buyer', 'owner', 'depositor', 'withdrawer', 'caller', 'from', 'to'];
  for (const key of candidates) {
    const val = v[key];
    if (typeof val === 'string' && val.startsWith('G') && val.length === 56) {
      return val;
    }
  }
  // Walk nested objects one level deep (event values are sometimes { Buy: { buyer: G… } })
  for (const inner of Object.values(v)) {
    if (inner && typeof inner === 'object') {
      const nested = extractUserAddress(inner);
      if (nested) return nested;
    }
  }
  return null;
}

/** Decode an XDR ScVal topic/value to a JS value (or string fallback). */
function decodeScVal(input: unknown): unknown {
  if (input == null) return null;
  // Already a JS primitive (string, number, …) — pass through
  if (typeof input !== 'object') return input;
  try {
    return scValToNative(input as Parameters<typeof scValToNative>[0]);
  } catch {
    try {
      return JSON.parse(JSON.stringify(input));
    } catch {
      return String(input);
    }
  }
}

/**
 * Fetch all new events since the last indexed ledger. Pages through using the
 * RPC's cursor so we don't drop events when more than `limit` exist in the
 * window. Advances the cursor to maxLedger+1 (NOT just maxLedger) so we don't
 * re-fetch the last block forever.
 */
async function pollEvents(): Promise<void> {
  // Record the poll attempt regardless of outcome — /health uses this to
  // distinguish "indexer is alive but quiet" from "indexer is hung."
  lastPollAt = Math.floor(Date.now() / 1000);

  const srv = getServer();
  const activeContracts = Object.values(CONTRACT_IDS).filter(Boolean);
  if (activeContracts.length === 0) return;

  try {
    let startLedger = lastLedger;
    if (startLedger === 0) {
      const latest = await srv.getLatestLedger();
      startLedger = latest.sequence;
      lastLedger = startLedger;
    }

    // Page through events until the RPC stops returning a cursor. Cap pages
    // per tick so a sudden surge doesn't pin the event loop.
    let cursor: string | undefined;
    let pagesThisTick = 0;
    const MAX_PAGES = 10;
    let totalIndexed = 0;
    let maxLedger = lastLedger;

    while (pagesThisTick < MAX_PAGES) {
      pagesThisTick++;
      const getEventsArgs: Parameters<typeof srv.getEvents>[0] = cursor
        ? ({ cursor, filters: [{ type: 'contract', contractIds: activeContracts }], limit: 200 } as Parameters<typeof srv.getEvents>[0])
        : { startLedger, filters: [{ type: 'contract', contractIds: activeContracts }], limit: 200 };
      const response = await srv.getEvents(getEventsArgs);

      const events = response?.events ?? [];
      if (events.length === 0) break;

      // Track per-tx event index so the UNIQUE (tx_hash, event_index) key
      // doesn't drop secondary events from multi-event txs (e.g. buy_call
      // emits lock_capital + receive_premium in one transaction).
      const perTxCounter: Record<string, number> = {};

      for (const event of events) {
        const ledger = event.ledger;
        if (ledger > maxLedger) maxLedger = ledger;

        const rawTopics = Array.isArray(event.topic) ? event.topic : [];
        const decodedTopics = rawTopics.map(decodeScVal).map((t) =>
          typeof t === 'string' ? t : JSON.stringify(t)
        );
        const eventType = parseEventType(decodedTopics);

        const decodedValue = decodeScVal(event.value);
        const userAddress = extractUserAddress(decodedValue);

        const txHash = event.txHash ?? `${event.id}`;
        const evIndex = (perTxCounter[txHash] ?? -1) + 1;
        perTxCounter[txHash] = evIndex;

        insertEvent({
          event_type: eventType,
          tx_hash: txHash,
          event_index: evIndex,
          block_time: Math.floor(new Date(event.ledgerClosedAt ?? Date.now()).getTime() / 1000),
          user_address: userAddress,
          data: JSON.stringify({ topics: decodedTopics, value: decodedValue, contractId: event.contractId, ledger }),
          indexed_at: Math.floor(Date.now() / 1000),
        });

        totalIndexed++;
      }

      // If the RPC returned a cursor, fetch the next page; otherwise stop.
      const next = (response as { cursor?: string; latestLedger?: number }).cursor;
      if (!next || events.length < 200) break;
      cursor = next;
    }

    // Advance past the last ledger we saw so we don't refetch it next tick.
    if (maxLedger > lastLedger) {
      lastLedger = maxLedger + 1;
      setLastIndexedLedger(lastLedger);
      if (totalIndexed > 0) {
        logger.info(`[Indexer] Indexed ${totalIndexed} events, cursor=${lastLedger}`);
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`[Indexer] Poll failed: ${message.slice(0, 200)}`);
    // Don't advance the cursor on failure — the next tick will retry from
    // the same startLedger. Persistent failures will surface in /health via
    // the indexer_poll_lag_seconds detail field.
  }
}

/** Start the event listener. Call once at server startup. */
export function startEventListener(): void {
  if (pollingTimer !== null) return; // Already running

  // Resume from the proper ledger cursor (indexer_state.last_ledger), NOT
  // from MAX(block_time) on events — those are different units (timestamp
  // vs sequence) and the audit found we were silently breaking resume by
  // conflating them.
  const persisted = getLastIndexedLedger();
  if (persisted > 0) {
    lastLedger = persisted;
  }

  logger.info(`[Indexer] Starting event listener (poll every ${POLL_INTERVAL_MS / 1000}s, from ledger ${lastLedger || '<latest>'})`);

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
    logger.info('[Indexer] Event listener stopped.');
  }
}
