/// Reflector oracle integration for XLM/USD price feeds.
///
/// Reflector returns prices with 14-decimal precision (1 USD = 10^14).
/// We convert to 7-decimal (our internal USDC precision).
///
/// Staleness threshold: 10 minutes (600 seconds) — Reflector updates every 5 min.
use soroban_sdk::{contracttype, symbol_short, Address, Env, Symbol};

/// Maximum age of an oracle price before we reject it (10 minutes).
const MAX_PRICE_AGE_SECS: u64 = 600;

/// Reflector returns 14-decimal precision: 1 USD = 10^14.
/// Our scale is 7-decimal: 1 USDC = 10^7.
/// Conversion: price_14dec / 10^7 = price_7dec
const REFLECTOR_TO_OUR: i128 = 10_000_000;

/// Asset variant matching Reflector's interface.
#[contracttype]
#[derive(Clone)]
pub enum Asset {
    Stellar(Address),
    Other(Symbol),
}

/// Price data returned by Reflector oracle.
#[contracttype]
pub struct PriceData {
    pub price: i128,
    pub timestamp: u64,
}

/// Fetch the current XLM/USD price from the Reflector oracle.
///
/// Returns the price as a 7-decimal fixed-point i128 (e.g. 0.12 USD = 1_200_000).
/// Panics if:
///   - Price is stale (> 10 minutes old)
///   - Price is zero or negative
pub fn get_xlm_price(env: &Env, oracle_address: &Address) -> i128 {
    let asset = Asset::Other(Symbol::new(env, "XLM"));
    let result: Option<PriceData> = env.invoke_contract(
        oracle_address,
        &symbol_short!("lastprice"),
        soroban_sdk::vec![env, soroban_sdk::IntoVal::into_val(&asset, env)],
    );

    let price_data = result.expect("oracle: no price available");

    // Staleness check
    let now = env.ledger().timestamp();
    if now > price_data.timestamp + MAX_PRICE_AGE_SECS {
        panic!("oracle: price is stale");
    }

    if price_data.price <= 0 {
        panic!("oracle: invalid price");
    }

    price_data.price / REFLECTOR_TO_OUR
}

/// Fetch oracle price with explicit staleness tolerance (for testing / settlement).
pub fn get_xlm_price_with_age(env: &Env, oracle_address: &Address, max_age_secs: u64) -> i128 {
    let asset = Asset::Other(Symbol::new(env, "XLM"));
    let result: Option<PriceData> = env.invoke_contract(
        oracle_address,
        &symbol_short!("lastprice"),
        soroban_sdk::vec![env, soroban_sdk::IntoVal::into_val(&asset, env)],
    );

    let price_data = result.expect("oracle: no price available");

    let now = env.ledger().timestamp();
    if now > price_data.timestamp + max_age_secs {
        panic!("oracle: price is stale");
    }

    if price_data.price <= 0 {
        panic!("oracle: invalid price");
    }

    price_data.price / REFLECTOR_TO_OUR
}
