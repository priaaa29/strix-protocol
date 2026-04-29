'use client';

import { useState, useEffect, useCallback } from 'react';
import { getVaultInfo, getLpInfo, depositToVault, withdrawFromVault } from '@/lib/soroban';
import type { VaultInfo, LpInfo, TxResult } from '@/lib/types';

export function useVault(walletAddress: string | null) {
  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null);
  const [lpInfo, setLpInfo] = useState<LpInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await getVaultInfo();
      setVaultInfo(info);

      if (walletAddress) {
        const lp = await getLpInfo(walletAddress);
        setLpInfo(lp);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load vault info');
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, [refresh]);

  const deposit = useCallback(
    async (amount: bigint): Promise<TxResult> => {
      if (!walletAddress) {
        return { hash: '', status: 'failed', error: 'Wallet not connected' };
      }
      const result = await depositToVault(walletAddress, amount);
      if (result.status === 'confirmed') {
        await refresh();
      }
      return result;
    },
    [walletAddress, refresh]
  );

  const withdraw = useCallback(
    async (shares: bigint): Promise<TxResult> => {
      if (!walletAddress) {
        return { hash: '', status: 'failed', error: 'Wallet not connected' };
      }
      const result = await withdrawFromVault(walletAddress, shares);
      if (result.status === 'confirmed') {
        await refresh();
      }
      return result;
    },
    [walletAddress, refresh]
  );

  return { vaultInfo, lpInfo, loading, error, refresh, deposit, withdraw };
}
