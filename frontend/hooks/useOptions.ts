'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getStrikes,
  fetchLivePremiums,
  isSettled,
  settleExpiry,
  buyCall,
  buyPut,
  buyCallSponsored,
  buyPutSponsored,
} from '@/lib/soroban';
import { fetchXlmPrice } from '@/lib/oracle';
import type { StrikeInfo, TxResult } from '@/lib/types';
import { PRICE_REFRESH_MS } from '@/lib/constants';

// Next Friday 08:00 UTC (matches create-epoch.sh)
function getNextFridayExpiry(): number {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 5=Fri
  const daysUntilFri = ((5 - day + 7) % 7) || 7;
  const nextFri = new Date(now);
  nextFri.setUTCDate(now.getUTCDate() + daysUntilFri);
  nextFri.setUTCHours(8, 0, 0, 0);
  return Math.floor(nextFri.getTime() / 1000);
}

export function useOptions() {
  const [strikes, setStrikes] = useState<StrikeInfo[]>([]);
  const [spotPrice, setSpotPrice] = useState<bigint>(0n);
  const [expiry, setExpiry] = useState<number>(getNextFridayExpiry());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rawStrikes, spot, isSettledResult] = await Promise.all([
        getStrikes(expiry),
        fetchXlmPrice(),
        isSettled(expiry),
      ]);
      // Premiums are stored as 0 on-chain (computed live to avoid budget limits).
      // Fetch live premiums from the PricingEngine via parallel simulations.
      const strikesData = await fetchLivePremiums(rawStrikes, expiry);
      setStrikes(strikesData);
      setSpotPrice(spot);
      setSettled(isSettledResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load options chain');
    } finally {
      setLoading(false);
    }
  }, [expiry]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, PRICE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const buyCallOption = useCallback(
    async (buyer: string, strike: bigint, amount: number, sponsored = false): Promise<TxResult> => {
      const result = sponsored
        ? await buyCallSponsored(buyer, strike, expiry, amount)
        : await buyCall(buyer, strike, expiry, amount);
      if (result.status === 'confirmed') await refresh();
      return result;
    },
    [expiry, refresh]
  );

  const buyPutOption = useCallback(
    async (buyer: string, strike: bigint, amount: number, sponsored = false): Promise<TxResult> => {
      const result = sponsored
        ? await buyPutSponsored(buyer, strike, expiry, amount)
        : await buyPut(buyer, strike, expiry, amount);
      if (result.status === 'confirmed') await refresh();
      return result;
    },
    [expiry, refresh]
  );

  const settle = useCallback(
    async (caller: string): Promise<TxResult> => {
      const result = await settleExpiry(caller, expiry);
      if (result.status === 'confirmed') await refresh();
      return result;
    },
    [expiry, refresh]
  );

  return {
    strikes,
    spotPrice,
    expiry,
    setExpiry,
    settled,
    loading,
    error,
    refresh,
    buyCallOption,
    buyPutOption,
    settle,
  };
}
