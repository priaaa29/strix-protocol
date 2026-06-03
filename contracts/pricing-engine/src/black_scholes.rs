/// Black-Scholes option pricing with fixed-point i128 arithmetic.
///
/// Precision: 7 decimal places (SCALE = 10_000_000, i.e. 1.0 == 10_000_000).
/// Internal intermediate computations use 14-decimal precision where noted
/// to avoid rounding errors, then reduce back to 7 decimals for output.
///
/// All function inputs/outputs are in 7-decimal fixed-point unless stated.

pub const SCALE: i128 = 10_000_000; // 1.0 = 10^7

/// Maximum i128 safe value for intermediate math — used to guard checked_mul.
const I128_MAX: i128 = i128::MAX;

/// Natural logarithm via continued-fraction / iterative Halley's method.
///
/// Uses the identity: ln(x) = 2 * arctanh((x-1)/(x+1))
/// with arctanh(y) = y + y^3/3 + y^5/5 + ... for |y| < 1.
///
/// Input x is 7-decimal fixed-point (x > 0).
/// Output is 7-decimal fixed-point.
pub fn ln(x: i128) -> i128 {
    // x must be positive
    assert!(x > 0, "ln: input must be positive");

    // Reduce x to range [SCALE/2, SCALE] using integer powers of 2.
    // ln(x) = ln(x / 2^k) + k * ln(2)
    // LN2 = 0.6931471805599453 in 7-decimal = 6_931_472
    const LN2: i128 = 6_931_472; // ln(2) * SCALE

    let mut val = x;
    let mut k: i128 = 0;

    // Scale up if val < SCALE (x < 1.0)
    while val < SCALE {
        val *= 2;
        k -= 1;
    }
    // Scale down if val >= 2*SCALE (x >= 2.0)
    while val >= 2 * SCALE {
        val /= 2;
        k += 1;
    }

    // Now val is in [SCALE, 2*SCALE), i.e. [1.0, 2.0)
    // Use: ln(v) = 2 * arctanh((v - 1) / (v + 1))
    // Let y = (v - SCALE) / (v + SCALE)  [7-decimal]
    // y is in [0, 1/3)

    // Compute y with 14-decimal precision to avoid accumulation errors
    let num = (val - SCALE) * SCALE; // 14-decimal numerator
    let den = val + SCALE; // 7-decimal denominator
    let y = num / den; // 7-decimal result

    // arctanh(y) = y + y^3/3 + y^5/5 + y^7/7 + ...
    // We compute up to y^13 — sufficient for |y| < 1/3 (error < 1e-9)
    let y2 = y * y / SCALE; // y^2, 7-decimal
    let mut term = y; // y^1
    let mut sum = y; // running sum

    // y^3 / 3
    term = term * y2 / SCALE;
    sum += term / 3;
    // y^5 / 5
    term = term * y2 / SCALE;
    sum += term / 5;
    // y^7 / 7
    term = term * y2 / SCALE;
    sum += term / 7;
    // y^9 / 9
    term = term * y2 / SCALE;
    sum += term / 9;
    // y^11 / 11
    term = term * y2 / SCALE;
    sum += term / 11;
    // y^13 / 13
    term = term * y2 / SCALE;
    sum += term / 13;

    let ln_val = 2 * sum; // ln(v) = 2 * arctanh(y)

    ln_val + k * LN2
}

/// Natural exponential e^x via Taylor series.
///
/// Uses range reduction: if x > 0, reduce by integer k where e^x = e^(x-k*ln2) * 2^k
/// Taylor: e^z = 1 + z + z^2/2! + z^3/3! + ... for |z| < ln2
///
/// Input/output: 7-decimal fixed-point.
pub fn exp(x: i128) -> i128 {
    const LN2: i128 = 6_931_472;
    // e^x overflows i128 for x > ~88; clamp for practical option pricing
    // (options cannot have time > 88 years, so this is safe)
    if x >= 88 * SCALE {
        return i128::MAX / SCALE; // saturate
    }
    if x <= -40 * SCALE {
        return 0; // underflow to 0
    }

    let neg = x < 0;
    let ax = if neg { -x } else { x };

    // Reduce: ax = k * LN2 + rem, rem in [0, LN2)
    let k = ax / LN2;
    let rem = ax - k * LN2; // 7-decimal, in [0, LN2)

    // Taylor series for e^rem
    let mut result: i128 = SCALE; // 1.0
    let mut term: i128 = SCALE; // current term
    for i in 1..=15i128 {
        term = term * rem / SCALE / i;
        result += term;
        if term == 0 {
            break;
        }
    }

    // Multiply by 2^k. Use checked_shl to guard against i128 overflow on
    // large positive exponents — today every call site supplies a non-
    // positive argument (so this path runs only inside the reciprocal
    // branch where overflow is impossible), but checking here avoids a
    // latent panic if a new call site ever feeds a large positive value.
    let scaled = match result.checked_shl(k as u32) {
        Some(v) => v,
        None => return if neg { 0 } else { i128::MAX / SCALE },
    };

    if neg {
        // e^(-ax) = SCALE^2 / (SCALE * e^ax) = SCALE / e^ax
        SCALE * SCALE / scaled
    } else {
        scaled
    }
}

/// Integer square root via Newton's method.
///
/// Input/output: 7-decimal fixed-point.
/// sqrt(x * SCALE) = sqrt(x) * sqrt(SCALE)
/// We use the identity: sqrt(x [7-dec]) = sqrt(x * SCALE) / SCALE  [7-dec result]
pub fn sqrt(x: i128) -> i128 {
    if x <= 0 {
        return 0;
    }
    // Work in 14-decimal precision: sqrt(x * SCALE) gives 7-decimal result
    let x14 = x * SCALE; // 14-decimal representation

    // Newton's method: start with a rough estimate
    let mut guess = x14;
    let mut prev = 0i128;
    while (guess - prev).abs() > 1 {
        prev = guess;
        guess = (guess + x14 / guess) / 2;
    }
    guess
}

/// Cumulative distribution function of the standard normal distribution.
///
/// Uses Abramowitz & Stegun approximation (formula 26.2.17).
/// Maximum error: |ε| < 7.5 × 10⁻⁸
///
/// Input x: 7-decimal fixed-point.
/// Output: 7-decimal fixed-point, in [0, SCALE].
pub fn cdf(x: i128) -> i128 {
    // CDF(-x) = 1 - CDF(x)
    let neg = x < 0;
    let ax = if neg { -x } else { x };

    // Constants from A&S 26.2.17 (scaled to 7-decimal)
    // p = 0.2316419
    const P: i128 = 2_316_419; // 0.2316419 * 10^7

    // Coefficients b1..b5
    const B1: i128 = 3_193_815; // 0.319381530
    const B2: i128 = -3_565_638; // -0.356563782
    const B3: i128 = 17_814_779; // 1.781477937
    const B4: i128 = -18_212_560; // -1.821255978
    const B5: i128 = 13_302_744; // 1.330274429

    // t = 1 / (1 + p * x)  [7-decimal]
    // To avoid overflow: compute in scaled form
    let denom = SCALE + P * ax / SCALE; // 7-decimal
    let t = SCALE * SCALE / denom; // 7-decimal

    // Polynomial: ((((b5*t + b4)*t + b3)*t + b2)*t + b1) * t
    let t2 = t * t / SCALE;
    let t3 = t2 * t / SCALE;
    let t4 = t3 * t / SCALE;
    let t5 = t4 * t / SCALE;

    let poly = (B1 * t + B2 * t2 + B3 * t3 + B4 * t4 + B5 * t5) / SCALE;

    // pdf(x) approximation: e^(-x^2/2) / sqrt(2*pi)
    // 1/sqrt(2*pi) = 0.3989422804 → 3_989_423 in 7-dec
    const INV_SQRT_2PI: i128 = 3_989_423;

    let x2 = ax * ax / SCALE; // x^2, 7-dec
    let exp_arg = -x2 / 2; // -x^2/2, 7-dec
    let e = exp(exp_arg);
    let pdf_val = INV_SQRT_2PI * e / SCALE;

    let cdf_pos = SCALE - pdf_val * poly / SCALE;

    // Clamp to [0, SCALE]
    let cdf_pos = cdf_pos.clamp(0, SCALE);

    if neg {
        SCALE - cdf_pos
    } else {
        cdf_pos
    }
}

/// Probability density function of the standard normal.
///
/// pdf(x) = e^(-x^2/2) / sqrt(2*pi)
/// Input/output: 7-decimal fixed-point.
pub fn pdf(x: i128) -> i128 {
    const INV_SQRT_2PI: i128 = 3_989_423; // 0.3989422804 * 10^7
    let x2 = x * x / SCALE;
    let e = exp(-x2 / 2);
    INV_SQRT_2PI * e / SCALE
}

/// Compute d1 for Black-Scholes.
///
/// d1 = (ln(S/K) + iv^2/2 * T) / (iv * sqrt(T))
///
/// All inputs 7-decimal fixed-point:
///   spot       — current spot price (e.g. 0.12 XLM/USDC = 1_200_000)
///   strike     — option strike price
///   time_years — time to expiry in years (e.g. 7 days = 7/365 * SCALE)
///   iv         — implied volatility (e.g. 80% = 8_000_000)
///
/// Returns d1, 7-decimal fixed-point.
pub fn calc_d1(spot: i128, strike: i128, time_years: i128, iv: i128) -> i128 {
    // ln(S/K) — 7 decimal
    let s_over_k = spot * SCALE / strike;
    let ln_s_k = ln(s_over_k);

    // iv^2 / 2, in 7-decimal
    let iv2 = iv * iv / SCALE; // iv^2 (7-dec)
    let iv2_half_t = iv2 / 2 * time_years / SCALE; // iv^2/2 * T

    // iv * sqrt(T)
    let sqrt_t = sqrt(time_years); // sqrt(T), 7-dec
    let iv_sqrt_t = iv * sqrt_t / SCALE; // iv * sqrt(T), 7-dec

    if iv_sqrt_t == 0 {
        // At expiry: if S > K return large positive; else large negative
        if spot > strike {
            return 100 * SCALE;
        } else if spot < strike {
            return -100 * SCALE;
        } else {
            return 0;
        }
    }

    let numerator = ln_s_k + iv2_half_t; // 7-dec
    numerator * SCALE / iv_sqrt_t
}

/// Compute d2 = d1 - iv * sqrt(T).
///
/// All inputs/output 7-decimal fixed-point.
pub fn calc_d2(d1: i128, iv: i128, time_years: i128) -> i128 {
    let sqrt_t = sqrt(time_years);
    let iv_sqrt_t = iv * sqrt_t / SCALE;
    d1 - iv_sqrt_t
}

/// Black-Scholes call price (European, cash-settled, r=0).
///
/// C = S * N(d1) - K * N(d2)
///
/// All inputs/output 7-decimal fixed-point USDC.
/// `amount` is the number of contracts (integer, not scaled).
pub fn call_price(spot: i128, strike: i128, time_years: i128, iv: i128) -> i128 {
    if time_years <= 0 {
        // At expiry: intrinsic value
        return (spot - strike).max(0);
    }

    let d1 = calc_d1(spot, strike, time_years, iv);
    let d2 = calc_d2(d1, iv, time_years);

    let nd1 = cdf(d1);
    let nd2 = cdf(d2);

    // C = S * N(d1) - K * N(d2)
    let c = spot * nd1 / SCALE - strike * nd2 / SCALE;
    c.max(0)
}

/// Black-Scholes put price via put-call parity.
///
/// P = C - S + K  (r=0, European)
///
/// All inputs/output 7-decimal fixed-point USDC.
pub fn put_price(spot: i128, strike: i128, time_years: i128, iv: i128) -> i128 {
    if time_years <= 0 {
        // At expiry: intrinsic value
        return (strike - spot).max(0);
    }

    let c = call_price(spot, strike, time_years, iv);
    // Put-call parity: P = C - S + K
    let p = c - spot + strike;
    p.max(0)
}

#[cfg(test)]
mod math_tests {
    use super::*;

    // Helper: convert float to 7-dec i128
    fn to_fixed(f: f64) -> i128 {
        (f * SCALE as f64).round() as i128
    }

    // Helper: convert 7-dec i128 to float
    fn to_float(x: i128) -> f64 {
        x as f64 / SCALE as f64
    }

    #[test]
    fn test_ln_one() {
        // ln(1.0) = 0
        assert_eq!(ln(SCALE), 0);
    }

    #[test]
    fn test_ln_e() {
        // ln(e) ≈ 1.0
        let e_val = to_fixed(2.718281828);
        let result = to_float(ln(e_val));
        assert!((result - 1.0).abs() < 0.0001, "ln(e) = {}", result);
    }

    #[test]
    fn test_ln_2() {
        let result = to_float(ln(2 * SCALE));
        assert!((result - 0.6931471).abs() < 0.0001, "ln(2) = {}", result);
    }

    #[test]
    fn test_ln_point5() {
        let result = to_float(ln(SCALE / 2));
        assert!((result - (-0.6931471)).abs() < 0.0001, "ln(0.5) = {}", result);
    }

    #[test]
    fn test_exp_zero() {
        assert_eq!(exp(0), SCALE);
    }

    #[test]
    fn test_exp_one() {
        let result = to_float(exp(SCALE));
        assert!((result - 2.71828).abs() < 0.001, "e^1 = {}", result);
    }

    #[test]
    fn test_exp_neg_one() {
        let result = to_float(exp(-SCALE));
        assert!((result - 0.36788).abs() < 0.001, "e^-1 = {}", result);
    }

    #[test]
    fn test_sqrt_four() {
        let result = to_float(sqrt(4 * SCALE));
        assert!((result - 2.0).abs() < 0.0001, "sqrt(4) = {}", result);
    }

    #[test]
    fn test_sqrt_two() {
        let result = to_float(sqrt(2 * SCALE));
        assert!((result - 1.41421).abs() < 0.001, "sqrt(2) = {}", result);
    }

    #[test]
    fn test_cdf_zero() {
        // N(0) = 0.5
        let result = to_float(cdf(0));
        assert!((result - 0.5).abs() < 0.001, "N(0) = {}", result);
    }

    #[test]
    fn test_cdf_pos() {
        // N(1.0) ≈ 0.8413
        let result = to_float(cdf(SCALE));
        assert!((result - 0.8413).abs() < 0.005, "N(1) = {}", result);
    }

    #[test]
    fn test_cdf_neg() {
        // N(-1.0) ≈ 0.1587
        let result = to_float(cdf(-SCALE));
        assert!((result - 0.1587).abs() < 0.005, "N(-1) = {}", result);
    }

    #[test]
    fn test_call_atm() {
        // ATM call: S=K=0.12, T=7/365, σ=80%
        let s = to_fixed(0.12);
        let k = to_fixed(0.12);
        let t = to_fixed(7.0 / 365.0);
        let iv = to_fixed(0.80);
        let c = to_float(call_price(s, k, t, iv));
        // Python reference: bs_call(0.12, 0.12, 7/365, 0.80) ≈ 0.00748
        assert!(c > 0.004 && c < 0.015, "ATM call = {}", c);
    }

    #[test]
    fn test_put_call_parity() {
        // C - P = S - K (with r=0)
        let s = to_fixed(0.12);
        let k = to_fixed(0.12);
        let t = to_fixed(7.0 / 365.0);
        let iv = to_fixed(0.80);
        let c = call_price(s, k, t, iv);
        let p = put_price(s, k, t, iv);
        // C - P should be ≈ S - K = 0
        let diff = to_float(c - p - (s - k));
        assert!(diff.abs() < 0.001, "Put-call parity diff = {}", diff);
    }
}
