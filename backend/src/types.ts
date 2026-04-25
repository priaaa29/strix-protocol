// Strix Protocol Backend — Type Definitions

export interface DbEvent {
  id?: number;
  event_type: string; // 'BUY_CALL' | 'BUY_PUT' | 'SETTLE' | 'CLAIM' | 'DEPOSIT' | 'WITHDRAW'
  tx_hash: string;
  block_time: number; // Unix timestamp
  user_address: string | null;
  data: string; // JSON blob
  indexed_at: number; // Unix timestamp
}

export interface DbFeedback {
  id?: number;
  user_address: string | null;
  rating: number; // 1-5
  category: string; // 'ux' | 'bug' | 'feature' | 'other'
  message: string;
  submitted_at: number;
}

export interface VaultStatsCache {
  tvl: string;
  totalShares: string;
  locked: string;
  available: string;
  sharePrice: string;
  cachedAt: number;
}

export interface OptionsChainCache {
  expiry: number;
  strikes: StrikeInfoCached[];
  cachedAt: number;
}

export interface StrikeInfoCached {
  strike: string;
  expiry: number;
  callPremium: string;
  putPremium: string;
}

export interface SorobanEvent {
  id: string;
  type: string;
  ledger: number;
  ledgerClosedAt: string;
  contractId: string;
  topic: string[];
  value: string;
}
