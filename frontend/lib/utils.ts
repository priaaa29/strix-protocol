// Strix Protocol — Utility Functions

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SCALE, SCALE_NUM } from './constants';

// ── TailwindCSS utility ────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Fixed-point Conversions ────────────────────────────────────────────────

/** Convert 7-decimal i128 to a JavaScript number. */
export function fromFixed(x: bigint): number {
  return Number(x) / SCALE_NUM;
}

/** Convert a number to 7-decimal bigint. */
export function toFixed(x: number): bigint {
  return BigInt(Math.round(x * SCALE_NUM));
}

/** Convert a USDC amount string (e.g. "100.5") to 7-decimal bigint. */
export function parseUsdc(s: string): bigint {
  const num = parseFloat(s);
  if (isNaN(num) || num < 0) return 0n;
  return BigInt(Math.round(num * SCALE_NUM));
}

// ── Formatting ─────────────────────────────────────────────────────────────

/** Format a 7-decimal bigint as a USDC string, e.g. "$1,234.56". */
export function formatUsdc(amount: bigint, decimals = 4): string {
  const num = fromFixed(amount);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/** Format USDC with $ prefix. */
export function formatUsdcDollar(amount: bigint, decimals = 4): string {
  return `$${formatUsdc(amount, decimals)}`;
}

/** Format share price as a ratio, e.g. "1.0523". */
export function formatSharePrice(price: bigint): string {
  return fromFixed(price).toFixed(6);
}

/** Format a timestamp as a human-readable date/time. */
export function formatExpiry(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/** Format a timestamp as a countdown string, e.g. "2d 4h 30m". */
export function formatCountdown(ts: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = ts - now;

  if (diff <= 0) return 'Expired';

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Shorten a Stellar address, e.g. "GABC...XYZ". */
export function shortenAddress(address: string, chars = 4): string {
  if (!address || address.length < chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/** Format a number as a percentage, e.g. "12.34%". */
export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/** Format basis points as a percentage, e.g. 8000 → "80.00%". */
export function formatBps(bps: number): string {
  return formatPercent(bps / 100);
}

/** Format a moneyness label. */
export function getMoneyness(strike: bigint, spot: bigint): 'ITM' | 'ATM' | 'OTM' {
  const ratio = Number(strike) / Number(spot);
  if (Math.abs(ratio - 1) < 0.005) return 'ATM';
  if (strike < spot) return 'ITM'; // for calls
  return 'OTM'; // for calls
}

/** Get Stellar Explorer transaction URL. */
export function explorerTxUrl(hash: string, network = 'testnet'): string {
  const base = network === 'mainnet'
    ? 'https://stellar.expert/explorer/public'
    : 'https://stellar.expert/explorer/testnet';
  return `${base}/tx/${hash}`;
}

/** Get Stellar Explorer contract URL. */
export function explorerContractUrl(contractId: string, network = 'testnet'): string {
  const base = network === 'mainnet'
    ? 'https://stellar.expert/explorer/public'
    : 'https://stellar.expert/explorer/testnet';
  return `${base}/contract/${contractId}`;
}

/** Estimate APY from premium earned over period. */
export function estimateApy(
  premiumEarned: bigint,
  tvl: bigint,
  periodDays: number
): number {
  if (tvl === 0n) return 0;
  const rate = fromFixed(premiumEarned) / fromFixed(tvl);
  const annualized = rate * (365 / periodDays);
  return annualized * 100;
}

/** Calculate P&L for a position. */
export function calcPnl(
  premiumPaid: bigint,
  payout: bigint,
  settled: boolean
): { pnl: bigint; pnlPct: number; positive: boolean } {
  if (!settled) {
    return { pnl: -premiumPaid, pnlPct: -100, positive: false };
  }
  const pnl = payout - premiumPaid;
  const pnlPct = premiumPaid > 0n
    ? (Number(pnl) / Number(premiumPaid)) * 100
    : 0;
  return { pnl, pnlPct, positive: pnl >= 0n };
}
