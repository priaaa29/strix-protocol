// Settlement Keeper — watches for expired, unsettled epochs and triggers settlement.
//
// After each Friday 16:00 UTC expiry, someone must call `settle(expiry)` on the
// OptionMarket contract. This keeper runs every 5 minutes, checks if any tracked
// expiry has passed and is not yet settled, then triggers settlement via stellar CLI.

import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';

const execFileAsync = promisify(execFile);

const OPTION_MARKET_ID = process.env.OPTION_MARKET_ID  || '';
const ADMIN_ADDR       = process.env.ADMIN_ADDRESS     || '';
// On Render (production) use the raw secret key directly.
// Locally, fall back to the key alias from the Stellar CLI keystore.
const STELLAR_SOURCE   = process.env.ADMIN_SECRET_KEY || process.env.STELLAR_KEY_ALIAS || '';
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

let keeperTimer: ReturnType<typeof setInterval> | null = null;

// Returns all Friday 16:00 UTC timestamps for the past 30 days + next 30 days.
// The keeper only tries to settle expiries that have passed.
function getCandidateExpiries(): number[] {
  const now = Math.floor(Date.now() / 1000);
  const candidates: number[] = [];
  // Walk back 4 weeks + forward 1 week looking for Fridays at 16:00 UTC
  const start = now - 28 * 24 * 3600;
  const end   = now + 7  * 24 * 3600;
  let t = start;
  while (t <= end) {
    const d = new Date(t * 1000);
    if (d.getUTCDay() === 5 && d.getUTCHours() === 16 && d.getUTCMinutes() === 0) {
      if (t < now) candidates.push(t); // only past expiries
      t += 7 * 24 * 3600; // jump to next week
    } else {
      t += 60; // advance 1 minute
    }
  }
  return candidates;
}

async function isSettled(expiry: number): Promise<boolean> {
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
    return stdout.trim() === 'true';
  } catch {
    return false;
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
  if (!OPTION_MARKET_ID || !ADMIN_ADDR || !STELLAR_SOURCE) {
    logger.warn('[SettlementKeeper] Missing OPTION_MARKET_ID, ADMIN_ADDRESS, or STELLAR_KEY_ALIAS — skipping');
    return;
  }

  const candidates = getCandidateExpiries();
  if (candidates.length === 0) return;

  for (const expiry of candidates) {
    const settled = await isSettled(expiry);
    if (!settled) {
      await settleExpiry(expiry);
      await new Promise(r => setTimeout(r, 3000));
    }
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
