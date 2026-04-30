// Oracle Keeper — refreshes the MockOracle price every 4 minutes.
//
// The deployed MockOracle binary stores the timestamp set during `set_price`
// and returns it in `lastprice`. The PricingEngine has a 5-minute staleness
// guard, so we refresh on a 4-minute interval to keep the chain unblocked.

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const ORACLE_ID  = process.env.ORACLE_ID      || '';
const ADMIN_ADDR = process.env.ADMIN_ADDRESS  || '';

// Refresh every 4 minutes (staleness threshold is 5 minutes)
const REFRESH_INTERVAL_MS = 4 * 60 * 1000;

// XLM/USDC price in 14-decimal (0.12 USDC = 12_000_000_000_000)
const ORACLE_PRICE_14DEC = '12000000000000';

// Stellar CLI source alias (key name in the stellar keystore)
const STELLAR_SOURCE = 'priya';

let keeperTimer: ReturnType<typeof setInterval> | null = null;

async function refreshOraclePrice(): Promise<void> {
  if (!ORACLE_ID || !ADMIN_ADDR) {
    console.warn('[OracleKeeper] Missing ORACLE_ID or ADMIN_ADDRESS — skipping refresh');
    return;
  }

  try {
    const { stdout, stderr } = await execFileAsync('stellar', [
      'contract', 'invoke',
      '--id', ORACLE_ID,
      '--source', STELLAR_SOURCE,
      '--network', 'testnet',
      '--',
      'set_price',
      '--admin', ADMIN_ADDR,
      '--price_14dec', ORACLE_PRICE_14DEC,
    ], { timeout: 60_000 });

    const out = stdout.trim() || stderr.trim();
    console.log(`[OracleKeeper] Oracle price refreshed — ${out.slice(0, 80)}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[OracleKeeper] Refresh failed: ${message.slice(0, 200)}`);
  }
}

/** Start the oracle keeper. Call once at server startup. */
export function startOracleKeeper(): void {
  if (keeperTimer !== null) return;

  console.log(`[OracleKeeper] Starting (refresh every ${REFRESH_INTERVAL_MS / 60_000}m)`);

  // Refresh immediately on startup, then on interval
  void refreshOraclePrice();
  keeperTimer = setInterval(() => void refreshOraclePrice(), REFRESH_INTERVAL_MS);
}

/** Stop the oracle keeper (for graceful shutdown). */
export function stopOracleKeeper(): void {
  if (keeperTimer !== null) {
    clearInterval(keeperTimer);
    keeperTimer = null;
    console.log('[OracleKeeper] Stopped.');
  }
}
