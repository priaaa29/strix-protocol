// Strix Protocol — Client-side Black-Scholes for premium preview
// Used for UI previews only — actual pricing is done on-chain.

const SCALE = 10_000_000;

function norm_cdf(x: number): number {
  // Abramowitz & Stegun approximation
  const a1 = 0.319381530;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;
  const p = 0.2316419;

  const t = 1 / (1 + p * Math.abs(x));
  const poly = t * (a1 + t * (a2 + t * (a3 + t * (a4 + t * a5))));
  const pdf = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  const cdf = 1 - pdf * poly;

  return x >= 0 ? cdf : 1 - cdf;
}

/**
 * Black-Scholes call price (r=0, European).
 *
 * @param spot   - spot price in 7-decimal bigint
 * @param strike - strike price in 7-decimal bigint
 * @param timeYears - time to expiry in years
 * @param ivBps  - implied volatility in basis points (8000 = 80%)
 * @returns premium in 7-decimal bigint
 */
export function bsCallPrice(
  spot: bigint,
  strike: bigint,
  timeYears: number,
  ivBps: number
): bigint {
  const S = Number(spot) / SCALE;
  const K = Number(strike) / SCALE;
  const T = timeYears;
  const sigma = ivBps / 10000;

  if (T <= 0) {
    return BigInt(Math.round(Math.max(0, S - K) * SCALE));
  }

  const d1 = (Math.log(S / K) + (sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const c = S * norm_cdf(d1) - K * norm_cdf(d2);
  return BigInt(Math.round(Math.max(0, c) * SCALE));
}

/**
 * Black-Scholes put price via put-call parity.
 *
 * @param spot   - spot price in 7-decimal bigint
 * @param strike - strike price in 7-decimal bigint
 * @param timeYears - time to expiry in years
 * @param ivBps  - implied volatility in basis points
 * @returns premium in 7-decimal bigint
 */
export function bsPutPrice(
  spot: bigint,
  strike: bigint,
  timeYears: number,
  ivBps: number
): bigint {
  const c = bsCallPrice(spot, strike, timeYears, ivBps);
  // P = C - S + K
  const cNum = Number(c) / SCALE;
  const S = Number(spot) / SCALE;
  const K = Number(strike) / SCALE;
  const p = cNum - S + K;
  return BigInt(Math.round(Math.max(0, p) * SCALE));
}

/**
 * Calculate time to expiry in years from current time.
 */
export function timeToExpiryYears(expiryTimestamp: number): number {
  const nowSecs = Math.floor(Date.now() / 1000);
  const diffSecs = expiryTimestamp - nowSecs;
  if (diffSecs <= 0) return 0;
  return diffSecs / 31_557_600; // 365.25 days
}

/**
 * Apply spread to a premium.
 * @param premium - raw BS premium in 7-decimal bigint
 * @param spreadBps - spread in basis points (100 = 1%)
 */
export function applySpread(premium: bigint, spreadBps: number): bigint {
  const factor = SCALE + Math.round(spreadBps * SCALE / 10000);
  return (premium * BigInt(factor)) / BigInt(SCALE);
}

/**
 * Full premium calculation matching on-chain logic.
 */
export function calcPremium(
  optionType: 'Call' | 'Put',
  spot: bigint,
  strike: bigint,
  expiry: number,
  amount: number,
  ivBps = 8000,
  spreadBps = 100
): bigint {
  const MIN_PREMIUM = 100_000n; // 0.01 USDC

  const T = timeToExpiryYears(expiry);

  const unitPremium = optionType === 'Call'
    ? bsCallPrice(spot, strike, T, ivBps)
    : bsPutPrice(spot, strike, T, ivBps);

  const withSpread = applySpread(unitPremium, spreadBps);
  const total = withSpread * BigInt(amount);

  return total < MIN_PREMIUM ? MIN_PREMIUM : total;
}
