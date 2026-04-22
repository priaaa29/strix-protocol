/// Reflector oracle integration for XLM/USDC price feeds.
///
/// Reflector oracle returns prices with 14-decimal precision.
/// We convert to 7-decimal (USDC standard precision).
///
/// Staleness threshold: 5 minutes (300 seconds).
use soroban_sdk::{contracttype, symbol_short, Address, Env, Symbol};

/// Maximum age of an oracle price before we reject it (5 minutes).
const MAX_PRICE_AGE_SECS: u64 = 300;

/// Reflector oracle returns 14-decimal precision.
const REFLECTOR_DECIMALS: i128 = 100_000_000_000_000; // 10^14

/// Our 7-decimal precision.
const OUR_SCALE: i128 = 10_000_000; // 10^7

/// Conversion factor: reflector → 7-decimal.
/// reflector_price / REFLECTOR_TO_OUR = price in 7-decimal
/// 10^14 / 10^7 = 10^7
const REFLECTOR_TO_OUR: i128 = 10_000_000; // 10^7

/// Price record returned by Reflector oracle.
///
/// Reflector's actual interface:
///   fn lastprice(asset: Asset) -> Option<PriceData>
/// where PriceData = { price: i128, timestamp: u64 }
#[contracttype]
pub struct PriceData {
    pub price: i128,
    pub timestamp: u64,
}

/// Asset type for Reflector queries.
///
/// Reflector uses a tagged union: Stellar(Address) | Other(Symbol)
/// XLM is "native" in Stellar, represented as Other("XLM") in many oracles,
/// but Reflector uses Asset::Other(Symbol::short("XLM")) for the XLM/USDC feed.
#[contracttype]
pub enum Asset {
    Stellar(Address),
    Other(Symbol),
}

/// Fetch the current XLM/USDC price from the Reflector oracle.
///
/// Returns the price as a 7-decimal fixed-point i128 (e.g. 0.12 USDC = 1_200_000).
/// Panics if:
///   - Oracle returns no price
///   - Price is stale (> 5 minutes old)
///   - Price is zero or negative
pub fn get_xlm_price(env: &Env, oracle_address: &Address) -> i128 {
    // Call Reflector oracle: lastprice(Asset::Other("XLM"))
    // Reflector's interface function name is "lastprice"
    let asset = Asset::Other(symbol_short!("XLM"));
    let price_data: Option<PriceData> = env.invoke_contract(
        oracle_address,
        &symbol_short!("lastprice"),
        soroban_sdk::vec![env, soroban_sdk::IntoVal::into_val(&asset, env)],
    );

    let price_data = match price_data {
        Some(p) => p,
        None => panic!("oracle: no price available"),
    };

    // Staleness check
    let now = env.ledger().timestamp();
    if now > price_data.timestamp + MAX_PRICE_AGE_SECS {
        panic!("oracle: price is stale");
    }

    // Validate price
    if price_data.price <= 0 {
        panic!("oracle: invalid price");
    }

    // Convert from Reflector's 14-decimal to our 7-decimal
    // reflector gives price in 14-dec; divide by 10^7 to get 7-dec
    let price_7dec = price_data.price / REFLECTOR_TO_OUR;

    if price_7dec <= 0 {
        panic!("oracle: price underflow after conversion");
    }

    price_7dec
}

/// Fetch oracle price with explicit staleness tolerance (for testing / settlement).
///
/// `max_age_override` — override the 5-minute staleness threshold.
pub fn get_xlm_price_with_age(env: &Env, oracle_address: &Address, max_age_secs: u64) -> i128 {
    let asset = Asset::Other(symbol_short!("XLM"));
    let price_data: Option<PriceData> = env.invoke_contract(
        oracle_address,
        &symbol_short!("lastprice"),
        soroban_sdk::vec![env, soroban_sdk::IntoVal::into_val(&asset, env)],
    );

    let price_data = match price_data {
        Some(p) => p,
        None => panic!("oracle: no price available"),
    };

    let now = env.ledger().timestamp();
    if now > price_data.timestamp + max_age_secs {
        panic!("oracle: price is stale");
    }

    if price_data.price <= 0 {
        panic!("oracle: invalid price");
    }

    let price_7dec = price_data.price / REFLECTOR_TO_OUR;

    if price_7dec <= 0 {
        panic!("oracle: price underflow after conversion");
    }

    price_7dec
}
