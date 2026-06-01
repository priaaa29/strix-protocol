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
  type TxProgress,
} from '@/lib/soroban';
import { fetchXlmPrice } from '@/lib/oracle';
import type { StrikeInfo, TxResult } from '@/lib/types';
import { PRICE_REFRESH_MS } from '@/lib/constants';
import { getNextFridayExpiry } from '@/lib/expiry';

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
    async (
      buyer: string,
      strike: bigint,
      amount: number,
      sponsored = false,
      onProgress?: TxProgress
    ): Promise<TxResult> => {
      const result = sponsored
        ? await buyCallSponsored(buyer, strike, expiry, amount, onProgress)
        : await buyCall(buyer, strike, expiry, amount, onProgress);
      if (result.status === 'confirmed') await refresh();
      return result;
    },
    [expiry, refresh]
  );

  const buyPutOption = useCallback(
    async (
      buyer: string,
      strike: bigint,
      amount: number,
      sponsored = false,
      onProgress?: TxProgress
    ): Promise<TxResult> => {
      const result = sponsored
        ? await buyPutSponsored(buyer, strike, expiry, amount, onProgress)
        : await buyPut(buyer, strike, expiry, amount, onProgress);
      if (result.status === 'confirmed') await refresh();
      return result;
    },
    [expiry, refresh]
  );

  const settle = useCallback(
    async (caller: string, onProgress?: TxProgress): Promise<TxResult> => {
      const result = await settleExpiry(caller, expiry, onProgress);
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
