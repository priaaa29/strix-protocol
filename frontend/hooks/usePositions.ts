'use client';

import { useState, useEffect, useCallback } from 'react';
import { getUserPositions, claimPosition } from '@/lib/soroban';
import type { Position, TxResult } from '@/lib/types';

export function usePositions(walletAddress: string | null) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!walletAddress) {
      setPositions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const pos = await getUserPositions(walletAddress);
      // Sort by expiry: soonest first, then settled positions at the bottom
      const sorted = [...pos].sort((a, b) => {
        if (a.settled !== b.settled) return a.settled ? 1 : -1;
        return a.expiry - b.expiry;
      });
      setPositions(sorted);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load positions');
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const claim = useCallback(
    async (positionId: number): Promise<TxResult> => {
      if (!walletAddress) {
        return { hash: '', status: 'failed', error: 'Wallet not connected' };
      }
      const result = await claimPosition(walletAddress, positionId);
      if (result.status === 'confirmed') await refresh();
      return result;
    },
    [walletAddress, refresh]
  );

  return { positions, loading, error, refresh, claim };
}
