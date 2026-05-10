// Strix Protocol — Network & Contract Configuration

import type { NetworkConfig } from './types';

export const NETWORKS: Record<string, NetworkConfig> = {
  testnet: {
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://soroban-testnet.stellar.org',
    horizonUrl: process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
    explorerUrl: 'https://stellar.expert/explorer/testnet',
  },
  mainnet: {
    rpcUrl: 'https://soroban-rpc.mainnet.stellar.gateway.fm',
    horizonUrl: 'https://horizon.stellar.org',
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
    explorerUrl: 'https://stellar.expert/explorer/public',
  },
};

// Active network (from env)
export const ACTIVE_NETWORK = (process.env.NEXT_PUBLIC_NETWORK as string) || 'testnet';
export const NETWORK_CONFIG = NETWORKS[ACTIVE_NETWORK];

// Contract IDs (filled from .env.local after deployment)
export const CONTRACT_IDS = {
  pricingEngine: process.env.NEXT_PUBLIC_PRICING_ENGINE_ID || '',
  vault: process.env.NEXT_PUBLIC_VAULT_ID || '',
  optionMarket: process.env.NEXT_PUBLIC_OPTION_MARKET_ID || '',
  usdcToken: process.env.NEXT_PUBLIC_USDC_TOKEN_ID || 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  oracle: process.env.NEXT_PUBLIC_ORACLE_ID || 'CAEDPEZDRCEJCF73ASC5JGNKCIJDV2QJQSW6DJ6B74MYALBNKCJ5IFP4',
} as const;

// Backend API
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Fixed-point scale: 1.0 = 10^7
export const SCALE = 10_000_000n;
export const SCALE_NUM = 10_000_000;

// Option contract size: 1 XLM per contract (7-decimal)
export const CONTRACT_SIZE = 10_000_000n;

// Minimum premium: 0.01 USDC
export const MIN_PREMIUM = 100_000n;

// Implied volatility default: 80%
export const DEFAULT_IV_BPS = 8000;

// Spread: 1%
export const DEFAULT_SPREAD_BPS = 100;

// Price refresh interval (ms)
export const PRICE_REFRESH_MS = 15_000;

// DIA oracle contract (testnet)
export const DIA_ORACLE_TESTNET = 'CAEDPEZDRCEJCF73ASC5JGNKCIJDV2QJQSW6DJ6B74MYALBNKCJ5IFP4';
