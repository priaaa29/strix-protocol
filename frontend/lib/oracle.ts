// Strix Protocol — Oracle price fetching utilities

import { CONTRACT_IDS } from './constants';
import { getSpotPrice } from './soroban';

// Cache the last known price to avoid flickering
let cachedPrice: { value: bigint; timestamp: number } | null = null;
const CACHE_TTL_MS = 10_000; // 10 seconds

/**
 * Fetch the current XLM/USDC price.
 * Returns a cached value if fresh enough, otherwise fetches from contract.
 */
export async function fetchXlmPrice(): Promise<bigint> {
  const now = Date.now();

  if (cachedPrice && now - cachedPrice.timestamp < CACHE_TTL_MS) {
    return cachedPrice.value;
  }

  try {
    const price = await getSpotPrice();
    cachedPrice = { value: price, timestamp: now };
    return price;
  } catch (err) {
    // Return cached value if fetch fails (avoids showing 0)
    if (cachedPrice) {
      console.warn('Oracle fetch failed, using cached price:', err);
      return cachedPrice.value;
    }
    throw err;
  }
}

/** Clear the price cache (useful after known price changes). */
export function clearPriceCache(): void {
  cachedPrice = null;
}

/** Get the Reflector oracle contract ID. */
export function getOracleContractId(): string {
  return CONTRACT_IDS.oracle;
}
