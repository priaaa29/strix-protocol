// Strix Protocol — TypeScript type definitions

export type Network = 'testnet' | 'mainnet';

export interface NetworkConfig {
  rpcUrl: string;
  horizonUrl: string;
  networkPassphrase: string;
  explorerUrl: string;
}

// ── Contract Types ─────────────────────────────────────────────────────────

export type OptionType = 'Call' | 'Put';

export interface Position {
  id: number;
  owner: string;
  optionType: OptionType;
  strike: bigint; // 7-decimal USDC
  expiry: number; // Unix timestamp
  amount: number; // number of contracts
  premiumPaid: bigint; // 7-decimal USDC
  lockedAmount: bigint; // 7-decimal USDC
  settled: boolean;
  payout: bigint; // 7-decimal USDC
  claimed: boolean;
}

export interface StrikeInfo {
  strike: bigint; // 7-decimal USDC
  expiry: number;
  callPremium: bigint; // 7-decimal USDC
  putPremium: bigint; // 7-decimal USDC
}

export interface VaultInfo {
  tvl: bigint; // 7-decimal USDC
  totalShares: bigint;
  locked: bigint;
  available: bigint;
  sharePrice: bigint; // 7-decimal (1.0 = 10_000_000n)
}

export interface LpInfo {
  shares: bigint;
  usdcValue: bigint; // 7-decimal USDC
  shareOfPoolBps: number; // basis points, e.g. 5000 = 50%
}

export interface SettlementInfo {
  settlementPrice: bigint;
  settledAt: number;
  settledBy: string;
}

// ── UI / Frontend Types ────────────────────────────────────────────────────

export interface WalletState {
  connected: boolean;
  address: string | null;
  network: string | null;
}

export type TxStatus = 'idle' | 'pending' | 'confirming' | 'confirmed' | 'failed';

export interface TxResult {
  hash: string;
  status: TxStatus;
  error?: string;
}

export interface OptionsChainRow {
  strike: bigint;
  callPremium: bigint;
  putPremium: bigint;
  expiry: number;
  moneyness: 'ITM' | 'ATM' | 'OTM'; // relative to spot
}

export interface VaultStats {
  tvl: bigint;
  sharePrice: bigint;
  locked: bigint;
  available: bigint;
  totalShares: bigint;
}
