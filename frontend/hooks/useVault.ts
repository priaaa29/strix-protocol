'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getVaultInfo, getLpInfo, depositToVault, withdrawFromVault } from '@/lib/soroban';
import type { VaultInfo, LpInfo, TxResult } from '@/lib/types';

type Listener = () => void;

interface SharedState {
  vaultInfo: VaultInfo | null;
  lpInfo: LpInfo | null;
  lpAddress: string | null;
  loading: boolean;
  error: string | null;
  inflight: Promise<void> | null;
  lastFetched: number;
  listeners: Set<Listener>;
  interval: ReturnType<typeof setInterval> | null;
}

const REFRESH_MS = 30_000;
const STALE_MS = 5_000;

const shared: SharedState = {
  vaultInfo: null,
  lpInfo: null,
  lpAddress: null,
  loading: false,
  error: null,
  inflight: null,
  lastFetched: 0,
  listeners: new Set(),
  interval: null,
};

function notify() {
  for (const l of shared.listeners) l();
}

async function fetchAll(walletAddress: string | null): Promise<void> {
  if (shared.inflight) return shared.inflight;
  shared.loading = true;
  shared.error = null;
  notify();

  const task = (async () => {
    try {
      const info = await getVaultInfo();
      shared.vaultInfo = info;

      if (walletAddress) {
        const lp = await getLpInfo(walletAddress);
        shared.lpInfo = lp;
        shared.lpAddress = walletAddress;
      } else {
        shared.lpInfo = null;
        shared.lpAddress = null;
      }
      shared.lastFetched = Date.now();
    } catch (err: unknown) {
      shared.error = err instanceof Error ? err.message : 'Failed to load vault info';
    } finally {
      shared.loading = false;
      shared.inflight = null;
      notify();
    }
  })();

  shared.inflight = task;
  return task;
}

export function useVault(walletAddress: string | null) {
  const [, forceRender] = useState(0);
  const addrRef = useRef(walletAddress);
  addrRef.current = walletAddress;

  useEffect(() => {
    const listener: Listener = () => forceRender((n) => n + 1);
    shared.listeners.add(listener);

    const needsRefresh =
      Date.now() - shared.lastFetched > STALE_MS ||
      shared.lpAddress !== walletAddress;
    if (needsRefresh) fetchAll(walletAddress);

    if (!shared.interval) {
      shared.interval = setInterval(() => {
        fetchAll(addrRef.current);
      }, REFRESH_MS);
    }

    return () => {
      shared.listeners.delete(listener);
      if (shared.listeners.size === 0 && shared.interval) {
        clearInterval(shared.interval);
        shared.interval = null;
      }
    };
  }, [walletAddress]);

  const refresh = useCallback(async () => {
    await fetchAll(addrRef.current);
  }, []);

  const deposit = useCallback(
    async (amount: bigint): Promise<TxResult> => {
      if (!addrRef.current) {
        return { hash: '', status: 'failed', error: 'Wallet not connected' };
      }
      const result = await depositToVault(addrRef.current, amount);
      if (result.status === 'confirmed') {
        await fetchAll(addrRef.current);
      }
      return result;
    },
    []
  );

  const withdraw = useCallback(
    async (shares: bigint): Promise<TxResult> => {
      if (!addrRef.current) {
        return { hash: '', status: 'failed', error: 'Wallet not connected' };
      }
      const result = await withdrawFromVault(addrRef.current, shares);
      if (result.status === 'confirmed') {
        await fetchAll(addrRef.current);
      }
      return result;
    },
    []
  );

  return {
    vaultInfo: shared.vaultInfo,
    lpInfo: walletAddress && shared.lpAddress === walletAddress ? shared.lpInfo : null,
    loading: shared.loading,
    error: shared.error,
    refresh,
    deposit,
    withdraw,
  };
}
