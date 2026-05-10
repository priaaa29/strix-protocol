/// DIA oracle integration for XLM/USD price feeds.
///
/// DIA oracle returns prices with 8-decimal precision (1 USD = 10^8).
/// We convert to 7-decimal (our internal USDC precision).
///
/// Staleness threshold: 5 minutes (300 seconds).
use soroban_sdk::{contracttype, symbol_short, Address, Env, String};

/// Maximum age of an oracle price before we reject it (5 minutes).
const MAX_PRICE_AGE_SECS: u64 = 300;

/// DIA oracle returns 8-decimal precision: 1 USD = 10^8.
/// Our scale is 7-decimal: 1 USDC = 10^7.
/// Conversion: price_8dec / 10 = price_7dec
const DIA_TO_OUR: u128 = 10;

/// Price record returned by DIA oracle.
///
/// DIA's interface:
///   fn get_value(key: String) -> OracleValue
/// where OracleValue is a tuple struct (price: u128, timestamp: u128)
/// with price in 8-decimal format and timestamp as Unix seconds.
#[contracttype]
pub struct OracleValue {
    pub price: u128,
    pub timestamp: u128,
}

/// Fetch the current XLM/USD price from the DIA oracle.
///
/// Returns the price as a 7-decimal fixed-point i128 (e.g. 0.12 USD = 1_200_000).
/// Panics if:
///   - Price is stale (> 5 minutes old)
///   - Price is zero
pub fn get_xlm_price(env: &Env, oracle_address: &Address) -> i128 {
    let key = String::from_str(env, "XLM/USD");
    let oracle_value: OracleValue = env.invoke_contract(
        oracle_address,
        &symbol_short!("get_value"),
        soroban_sdk::vec![env, soroban_sdk::IntoVal::into_val(&key, env)],
    );

    // Staleness check
    let now = env.ledger().timestamp() as u128;
    if now > oracle_value.timestamp + MAX_PRICE_AGE_SECS as u128 {
        panic!("oracle: price is stale");
    }

    if oracle_value.price == 0 {
        panic!("oracle: invalid price");
    }

    // Convert from DIA's 8-decimal to our 7-decimal (divide by 10)
    let price_7dec = (oracle_value.price / DIA_TO_OUR) as i128;

    if price_7dec <= 0 {
        panic!("oracle: price underflow after conversion");
    }

    price_7dec
}

/// Fetch oracle price with explicit staleness tolerance (for testing / settlement).
pub fn get_xlm_price_with_age(env: &Env, oracle_address: &Address, max_age_secs: u64) -> i128 {
    let key = String::from_str(env, "XLM/USD");
    let oracle_value: OracleValue = env.invoke_contract(
        oracle_address,
        &symbol_short!("get_value"),
        soroban_sdk::vec![env, soroban_sdk::IntoVal::into_val(&key, env)],
    );

    let now = env.ledger().timestamp() as u128;
    if now > oracle_value.timestamp + max_age_secs as u128 {
        panic!("oracle: price is stale");
    }

    if oracle_value.price == 0 {
        panic!("oracle: invalid price");
    }

    let price_7dec = (oracle_value.price / DIA_TO_OUR) as i128;

    if price_7dec <= 0 {
        panic!("oracle: price underflow after conversion");
    }

    price_7dec
}
