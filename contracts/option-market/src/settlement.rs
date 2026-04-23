/// Settlement payout calculations for European cash-settled options.
use crate::types::{OptionType, Position};

/// Calculate the cash settlement payout for a single position.
///
/// European cash-settlement in USDC:
///   Call: max(0, settlement_price - strike) * amount * contract_size
///   Put:  max(0, strike - settlement_price) * amount * contract_size
///
/// # Arguments
/// * `position`         — the option position
/// * `settlement_price` — oracle price at expiry, 7-decimal USDC
/// * `contract_size`    — size of each contract in XLM, 7-decimal
///
/// Returns payout in 7-decimal USDC. Returns 0 for OTM options.
pub fn calc_payout(position: &Position, settlement_price: i128, contract_size: u64) -> i128 {
    // Total XLM exposure = amount * contract_size (both in their own scales)
    // amount is integer (number of contracts)
    // contract_size is 7-decimal XLM (10_000_000 = 1 XLM)
    // amount_xlm_7dec = amount * contract_size (7-decimal XLM)
    let amount_xlm_7dec = position.amount as i128 * contract_size as i128;

    // Payout per XLM (7-decimal USDC):
    //   Call: max(0, S - K)
    //   Put:  max(0, K - S)
    // Total payout = payout_per_xlm * amount_xlm_7dec / SCALE
    const SCALE: i128 = 10_000_000;

    match position.option_type {
        OptionType::Call => {
            if settlement_price > position.strike {
                let price_diff = settlement_price - position.strike;
                // payout = (S - K) * amount_xlm / SCALE
                price_diff
                    .checked_mul(amount_xlm_7dec)
                    .expect("overflow in call payout")
                    / SCALE
            } else {
                0
            }
        }
        OptionType::Put => {
            if settlement_price < position.strike {
                let price_diff = position.strike - settlement_price;
                price_diff
                    .checked_mul(amount_xlm_7dec)
                    .expect("overflow in put payout")
                    / SCALE
            } else {
                0
            }
        }
    }
}

/// Validate that a payout does not exceed the locked collateral for a position.
///
/// Acts as a safety check to prevent vault insolvency.
/// Returns the actual payout (capped at locked_amount if needed).
pub fn validated_payout(payout: i128, locked_amount: i128) -> i128 {
    // Payout should never exceed locked collateral by design,
    // but we cap for safety.
    payout.min(locked_amount)
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, Env};

    fn make_position(env: &Env, opt_type: OptionType, strike: i128, amount: u64) -> Position {
        Position {
            id: 0,
            owner: Address::generate(env),
            option_type: opt_type,
            strike,
            expiry: 1_700_000_000 + 7 * 86_400,
            amount,
            premium_paid: 0,
            locked_amount: strike * amount as i128,
            settled: false,
            payout: 0,
            claimed: false,
        }
    }

    fn to_fixed(f: f64) -> i128 {
        (f * 10_000_000.0).round() as i128
    }

    fn to_float(x: i128) -> f64 {
        x as f64 / 10_000_000.0
    }

    #[test]
    fn test_call_itm_payout() {
        let env = Env::default();
        let pos = make_position(&env, OptionType::Call, to_fixed(0.10), 1);
        // Settlement at 0.12 → payout = (0.12 - 0.10) * 1 XLM = 0.02 USDC
        let payout = calc_payout(&pos, to_fixed(0.12), 10_000_000); // 1 XLM per contract
        assert!(
            (to_float(payout) - 0.02).abs() < 0.0001,
            "Call ITM payout = {}",
            to_float(payout)
        );
    }

    #[test]
    fn test_call_otm_payout() {
        let env = Env::default();
        let pos = make_position(&env, OptionType::Call, to_fixed(0.15), 1);
        // Settlement at 0.12 (below strike) → OTM → 0
        let payout = calc_payout(&pos, to_fixed(0.12), 10_000_000);
        assert_eq!(payout, 0, "Call OTM should yield 0");
    }

    #[test]
    fn test_put_itm_payout() {
        let env = Env::default();
        let pos = make_position(&env, OptionType::Put, to_fixed(0.15), 1);
        // Settlement at 0.12 → payout = (0.15 - 0.12) * 1 = 0.03
        let payout = calc_payout(&pos, to_fixed(0.12), 10_000_000);
        assert!(
            (to_float(payout) - 0.03).abs() < 0.0001,
            "Put ITM payout = {}",
            to_float(payout)
        );
    }

    #[test]
    fn test_put_otm_payout() {
        let env = Env::default();
        let pos = make_position(&env, OptionType::Put, to_fixed(0.10), 1);
        // Settlement at 0.12 (above strike) → OTM → 0
        let payout = calc_payout(&pos, to_fixed(0.12), 10_000_000);
        assert_eq!(payout, 0, "Put OTM should yield 0");
    }

    #[test]
    fn test_multiple_contracts() {
        let env = Env::default();
        let pos = make_position(&env, OptionType::Call, to_fixed(0.10), 5);
        // Settlement at 0.12 → payout = 0.02 * 5 = 0.10
        let payout = calc_payout(&pos, to_fixed(0.12), 10_000_000);
        assert!(
            (to_float(payout) - 0.10).abs() < 0.001,
            "5-contract payout = {}",
            to_float(payout)
        );
    }
}
