// Strix Protocol — /api/vault router

import { Router, Request, Response } from 'express';
import { rpc, Contract, TransactionBuilder, BASE_FEE, Networks, scValToNative } from '@stellar/stellar-sdk';
import { getVaultStatsCache, setVaultStatsCache } from '../indexer/db';
import { logger } from '../logger';
import { withRetry } from '../rpc-retry';

const router = Router();

const RPC_URL = process.env.RPC_URL || 'https://soroban-testnet.stellar.org';
const VAULT_ID = process.env.VAULT_ID || '';
const NETWORK_PASSPHRASE = process.env.NETWORK === 'mainnet'
  ? Networks.PUBLIC
  : Networks.TESTNET;

// Cache is fresh for 60 seconds
const CACHE_TTL_SECONDS = 60;
// Use the admin address (must be funded on testnet) as the simulation source account.
const DUMMY_SOURCE = process.env.ADMIN_ADDRESS || 'GC74PVJTC4FQRYFAJVFAPUXPBKGBAJIUN7KO7FMCWXMV5X3EWWP7KM6O';

async function fetchVaultStatsFromChain(): Promise<{
  tvl: string; totalShares: string; locked: string; available: string; sharePrice: string;
} | null> {
  if (!VAULT_ID) return null;

  const server = new rpc.Server(RPC_URL, { allowHttp: false });

  try {
    const account = await withRetry('vault:getAccount', () => server.getAccount(DUMMY_SOURCE));
    const contract = new Contract(VAULT_ID);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
      .addOperation(contract.call('get_vault_info'))
      .setTimeout(30)
      .build();

    const simResult = await withRetry('vault:simulate', () => server.simulateTransaction(tx));

    if (rpc.Api.isSimulationError(simResult)) {
      logger.warn('[Vault API] Simulation error:', simResult.error);
      return null;
    }

    if (!('result' in simResult) || !simResult.result) return null;

    const raw = scValToNative(simResult.result.retval) as Record<string, unknown>;

    return {
      tvl: String(raw.tvl ?? '0'),
      totalShares: String(raw.total_shares ?? '0'),
      locked: String(raw.locked ?? '0'),
      available: String(raw.available ?? '0'),
      sharePrice: String(raw.share_price ?? '10000000'),
    };
  } catch (err: unknown) {
    logger.warn('[Vault API] Chain fetch failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * GET /api/vault/stats
 * Returns TVL, shares, locked/available capital. Cached for 60s.
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    // Check cache
    const cached = getVaultStatsCache();
    const now = Math.floor(Date.now() / 1000);

    if (cached && typeof cached.cached_at === 'number' && now - cached.cached_at < CACHE_TTL_SECONDS) {
      res.json({
        source: 'cache',
        cachedAt: cached.cached_at,
        tvl: cached.tvl,
        totalShares: cached.total_shares,
        locked: cached.locked,
        available: cached.available,
        sharePrice: cached.share_price,
      });
      return;
    }

    // Fetch fresh from chain
    const fresh = await fetchVaultStatsFromChain();

    if (fresh) {
      setVaultStatsCache(fresh);
      res.json({
        source: 'chain',
        cachedAt: now,
        tvl: fresh.tvl,
        totalShares: fresh.totalShares,
        locked: fresh.locked,
        available: fresh.available,
        sharePrice: fresh.sharePrice,
      });
    } else if (cached) {
      // Return stale cache rather than failing
      res.json({
        source: 'stale_cache',
        cachedAt: cached.cached_at,
        tvl: cached.tvl,
        totalShares: cached.total_shares,
        locked: cached.locked,
        available: cached.available,
        sharePrice: cached.share_price,
      });
    } else {
      res.status(503).json({ error: 'Vault stats unavailable — contract not deployed or RPC unreachable' });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[API] GET /vault/stats error:', message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
