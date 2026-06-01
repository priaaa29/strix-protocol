// Settlement Keeper — watches for expired, unsettled epochs and triggers settlement.
//
// After each Friday EXPIRY_HOUR_UTC expiry, someone must call `settle(expiry)` on
// the OptionMarket contract. This keeper runs every 5 minutes, checks if any
// tracked expiry has passed and is not yet settled, then triggers settlement via
// stellar CLI.

import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';
import { EXPIRY_HOUR_UTC } from './expiry';

const execFileAsync = promisify(execFile);

const OPTION_MARKET_ID = process.env.OPTION_MARKET_ID  || '';
const ADMIN_ADDR       = process.env.ADMIN_ADDRESS     || '';
// On Render (production) use the raw secret key directly.
// Locally, fall back to the key alias from the Stellar CLI keystore.
const STELLAR_SOURCE   = process.env.ADMIN_SECRET_KEY || process.env.STELLAR_KEY_ALIAS || '';
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

let keeperTimer: ReturnType<typeof setInterval> | null = null;
let tickRunning = false; // re-entrancy guard for overlapping intervals

// Returns all Friday EXPIRY_HOUR_UTC timestamps within [now - 28d, now]. The
// keeper only tries to settle expiries that have passed; the lookback bounds
// the work each tick.
function getCandidateExpiries(): number[] {
  const now = Math.floor(Date.now() / 1000);
  const candidates: number[] = [];
  // Find the most recent Friday at EXPIRY_HOUR_UTC, then walk back week by week.
  const today = new Date(now * 1000);
  const dow = today.getUTCDay();
  // Days since most recent Friday (0 if today is Friday, 1 if Sat, …)
  const daysSinceFri = (dow - 5 + 7) % 7;
  const mostRecentFri = new Date(today);
  mostRecentFri.setUTCDate(today.getUTCDate() - daysSinceFri);
  mostRecentFri.setUTCHours(EXPIRY_HOUR_UTC, 0, 0, 0);

  let cursorTs = Math.floor(mostRecentFri.getTime() / 1000);
  const earliest = now - 28 * 24 * 3600;
  while (cursorTs >= earliest) {
    if (cursorTs < now) candidates.push(cursorTs);
    cursorTs -= 7 * 24 * 3600;
  }
  return candidates;
}

// Three-valued isSettled — distinguishes "definitely settled" from "definitely
// not settled" from "unknown" (RPC error). The keeper treats UNKNOWN as
// skip-this-tick rather than spending sponsor XLM on a redundant settle().
type SettleState = 'SETTLED' | 'OPEN' | 'UNKNOWN';

async function isSettled(expiry: number): Promise<SettleState> {
  try {
    const { stdout } = await execFileAsync('stellar', [
      'contract', 'invoke',
      '--id', OPTION_MARKET_ID,
      '--source', STELLAR_SOURCE,
      '--network', 'testnet',
      '--',
      'is_settled',
      '--expiry', String(expiry),
    ], { timeout: 30_000 });
    return stdout.trim() === 'true' ? 'SETTLED' : 'OPEN';
  } catch (err: unknown) {
    logger.warn(`[SettlementKeeper] is_settled(${expiry}) failed: ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`);
    return 'UNKNOWN';
  }
}

async function settleExpiry(expiry: number): Promise<void> {
  logger.info(`[SettlementKeeper] Settling expiry ${expiry}...`);
  try {
    const { stdout, stderr } = await execFileAsync('stellar', [
      'contract', 'invoke',
      '--id', OPTION_MARKET_ID,
      '--source', STELLAR_SOURCE,
      '--network', 'testnet',
      '--send=yes',
      '--',
      'settle',
      '--caller', ADMIN_ADDR,
      '--expiry', String(expiry),
    ], { timeout: 60_000 });

    const out = stdout.trim() || stderr.trim();
    logger.info(`[SettlementKeeper] Settled expiry ${expiry} — ${out.slice(0, 120)}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('already settled') || msg.includes('already_settled')) {
      logger.info(`[SettlementKeeper] Expiry ${expiry} already settled.`);
    } else {
      logger.warn(`[SettlementKeeper] Failed to settle ${expiry}: ${msg.slice(0, 200)}`);
    }
  }
}

async function runSettlementCheck(): Promise<void> {
  if (tickRunning) {
    logger.info('[SettlementKeeper] Previous tick still running — skipping');
    return;
  }
  tickRunning = true;
  try {
    if (!OPTION_MARKET_ID || !ADMIN_ADDR || !STELLAR_SOURCE) {
      logger.warn('[SettlementKeeper] Missing OPTION_MARKET_ID, ADMIN_ADDRESS, or STELLAR_KEY_ALIAS — skipping');
      return;
    }

    const candidates = getCandidateExpiries();
    if (candidates.length === 0) return;

    for (const expiry of candidates) {
      const state = await isSettled(expiry);
      if (state === 'OPEN') {
        await settleExpiry(expiry);
        await new Promise((r) => setTimeout(r, 3000));
      }
      // SETTLED → skip silently. UNKNOWN → skip this tick; the next interval
      // will retry. Avoids re-submitting settle() on transient RPC errors.
    }
  } finally {
    tickRunning = false;
  }
}

export function startSettlementKeeper(): void {
  if (keeperTimer !== null) return;
  logger.info('[SettlementKeeper] Starting (check interval: 5m)');

  void runSettlementCheck();
  keeperTimer = setInterval(() => void runSettlementCheck(), CHECK_INTERVAL_MS);
}

export function stopSettlementKeeper(): void {
  if (keeperTimer !== null) {
    clearInterval(keeperTimer);
    keeperTimer = null;
    logger.info('[SettlementKeeper] Stopped.');
  }
}
