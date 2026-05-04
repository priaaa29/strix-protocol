// Strix Protocol — /api/options router

import { Router, Request, Response } from 'express';
import {
  SorobanRpc, Contract, TransactionBuilder, BASE_FEE, Networks,
  scValToNative, nativeToScVal,
} from '@stellar/stellar-sdk';
import { getOptionsChainCache, setOptionsChainCache } from '../indexer/db';
import type { StrikeInfoCached } from '../types';
import { logger } from '../logger';

const router = Router();

const RPC_URL = process.env.RPC_URL || 'https://soroban-testnet.stellar.org';
const OPTION_MARKET_ID = process.env.OPTION_MARKET_ID || '';
const NETWORK_PASSPHRASE = process.env.NETWORK === 'mainnet'
  ? Networks.PUBLIC
  : Networks.TESTNET;

const CACHE_TTL_SECONDS = 120; // Options chain cached for 2 minutes
const DUMMY_SOURCE = process.env.ADMIN_ADDRESS || 'GC74PVJTC4FQRYFAJVFAPUXPBKGBAJIUN7KO7FMCWXMV5X3EWWP7KM6O';

async function fetchStrikesFromChain(expiry: number): Promise<StrikeInfoCached[] | null> {
  if (!OPTION_MARKET_ID) return null;

  const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

  try {
    const account = await server.getAccount(DUMMY_SOURCE);
    const contract = new Contract(OPTION_MARKET_ID);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
      .addOperation(contract.call('get_strikes', nativeToScVal(expiry, { type: 'u64' })))
      .setTimeout(30)
      .build();

    const simResult = await server.simulateTransaction(tx);

    if (SorobanRpc.Api.isSimulationError(simResult)) {
      logger.warn('[Options API] Simulation error:', simResult.error);
      return null;
    }

    if (!('result' in simResult) || !simResult.result) return [];

    const raw = scValToNative(simResult.result.retval) as Array<Record<string, unknown>>;

    return raw.map((s) => ({
      strike: String(s.strike ?? '0'),
      expiry: Number(s.expiry ?? expiry),
      callPremium: String(s.call_premium ?? '0'),
      putPremium: String(s.put_premium ?? '0'),
    }));
  } catch (err: unknown) {
    logger.warn('[Options API] Chain fetch failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** Compute the next weekly Friday expiry (Unix timestamp). */
function nextFridayExpiry(): number {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 5=Fri
  const daysUntilFriday = (5 - day + 7) % 7 || 7;
  const friday = new Date(now);
  friday.setUTCDate(now.getUTCDate() + daysUntilFriday);
  friday.setUTCHours(16, 0, 0, 0); // 4 PM UTC
  return Math.floor(friday.getTime() / 1000);
}

/**
 * GET /api/options/chain?expiry=<unix_timestamp>
 * Returns strikes and premiums for the given expiry (defaults to next Friday).
 */
router.get('/chain', async (req: Request, res: Response) => {
  const expiry = req.query.expiry ? Number(req.query.expiry) : nextFridayExpiry();

  if (isNaN(expiry) || expiry <= 0) {
    res.status(400).json({ error: 'Invalid expiry timestamp' });
    return;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const cached = getOptionsChainCache(expiry);

    if (cached && typeof cached.cached_at === 'number' && now - cached.cached_at < CACHE_TTL_SECONDS) {
      res.json({ source: 'cache', expiry, cachedAt: cached.cached_at, strikes: cached.strikes });
      return;
    }

    const fresh = await fetchStrikesFromChain(expiry);

    if (fresh !== null) {
      setOptionsChainCache(expiry, fresh);
      res.json({ source: 'chain', expiry, cachedAt: now, strikes: fresh });
    } else if (cached) {
      res.json({ source: 'stale_cache', expiry, cachedAt: cached.cached_at, strikes: cached.strikes });
    } else {
      res.status(503).json({ error: 'Options chain unavailable — contract not deployed or RPC unreachable' });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[API] GET /options/chain error:', message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/options/expiries
 * Returns the next 4 weekly Friday expiries.
 */
router.get('/expiries', (_req: Request, res: Response) => {
  const expiries: number[] = [];
  const now = new Date();

  for (let i = 0; i < 4; i++) {
    const day = now.getUTCDay();
    const daysUntilFriday = ((5 - day + 7) % 7 || 7) + i * 7;
    const friday = new Date(now);
    friday.setUTCDate(now.getUTCDate() + daysUntilFriday);
    friday.setUTCHours(16, 0, 0, 0);
    expiries.push(Math.floor(friday.getTime() / 1000));
  }

  res.json({ expiries });
});

export default router;
