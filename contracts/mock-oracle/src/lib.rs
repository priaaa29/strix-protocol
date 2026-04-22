//! MockOracle — Testnet price oracle implementing the Reflector interface.
//!
//! Deployed on testnet as a stand-in for the Reflector oracle, which does
//! not have a stable testnet deployment. The admin can update the XLM price
//! at any time. The price is returned in 14-decimal format (matching Reflector)
//! so the PricingEngine's oracle.rs conversion layer is exercised unchanged.
//!
//! Interface mirrors Reflector oracle:
//!   lastprice(asset: Asset) -> Option<PriceData>
//!   where PriceData { price: i128, timestamp: u64 }

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Symbol,
};

// ── Reflector-compatible types ─────────────────────────────────────────────

/// Asset variant matching Reflector's interface.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum Asset {
    Stellar(Address),
    Other(Symbol),
}

/// Price data matching Reflector's return type.
#[contracttype]
#[derive(Clone, Debug)]
pub struct PriceData {
    pub price: i128,
    pub timestamp: u64,
}

// ── Storage keys ────────────────────────────────────────────────────────────

#[contracttype]
enum DataKey {
    Admin,
    /// Stored in 14-decimal format (matching Reflector: 1 USDC = 10^14)
    Price,
    /// Unix timestamp of last price update
    Timestamp,
}

// ── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct MockOracle;

#[contractimpl]
impl MockOracle {
    /// Initialize the oracle with admin address and initial XLM price.
    ///
    /// `initial_price_14dec`: price in 14-decimal format.
    /// Example: 0.12 USDC per XLM = 1_200_000_000_000 (1.2 × 10^12)
    pub fn initialize(env: Env, admin: Address, initial_price_14dec: i128) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Price, &initial_price_14dec);
        env.storage().instance().set(&DataKey::Timestamp, &env.ledger().timestamp());

        env.storage().instance().extend_ttl(100_000, 1_000_000);
    }

    /// Update the XLM/USDC price. Only callable by admin.
    ///
    /// `price_14dec`: new price in 14-decimal format.
    pub fn set_price(env: Env, admin: Address, price_14dec: i128) {
        admin.require_auth();

        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin)
            .expect("not initialized");
        if admin != stored_admin {
            panic!("unauthorized");
        }
        if price_14dec <= 0 {
            panic!("price must be positive");
        }

        env.storage().instance().set(&DataKey::Price, &price_14dec);
        env.storage().instance().set(&DataKey::Timestamp, &env.ledger().timestamp());

        env.storage().instance().extend_ttl(100_000, 1_000_000);
    }

    /// Returns the current price for any asset (always returns XLM/USDC price).
    ///
    /// Matches the Reflector oracle interface: `lastprice(asset) -> Option<PriceData>`
    /// The PricingEngine calls this with `Asset::Other(Symbol::new(env, "XLM"))`.
    ///
    /// Always returns `env.ledger().timestamp()` so the PricingEngine's 5-minute
    /// staleness check always passes on testnet — no keeper bot required.
    pub fn lastprice(env: Env, _asset: Asset) -> Option<PriceData> {
        env.storage().instance().extend_ttl(100_000, 1_000_000);

        let price: i128 = env.storage().instance().get(&DataKey::Price)?;

        // Use current ledger time so the staleness window never expires.
        Some(PriceData { price, timestamp: env.ledger().timestamp() })
    }

    /// Upgrade the contract WASM in-place. Only callable by admin.
    /// Allows fixing bugs without changing the contract address.
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin)
            .expect("not initialized");
        if admin != stored_admin {
            panic!("unauthorized");
        }
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    /// Get the current admin address.
    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin)
            .expect("not initialized")
    }

    /// Get the current price in 14-decimal format.
    pub fn price(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Price)
            .expect("not initialized")
    }

    /// Convenience: get price in 7-decimal format (as used by the rest of Strix).
    /// Divides the 14-decimal Reflector price by 10^7.
    pub fn price_7dec(env: Env) -> i128 {
        let price_14dec: i128 = env.storage().instance().get(&DataKey::Price)
            .expect("not initialized");
        price_14dec / 10_000_000
    }
}

// ── Helper: price conversion ───────────────────────────────────────────────

/// Convert a human-readable USDC price to 14-decimal format.
/// Example: 0.12 USDC → pass numerator=12, denominator=100
/// Returns: 12 * 10^12 = 1_200_000_000_000
pub const fn usdc_to_14dec(numerator: i128, denominator: i128) -> i128 {
    numerator * 100_000_000_000_000 / denominator
}

// ── Symbol helper ──────────────────────────────────────────────────────────

pub const XLM_SYMBOL: &str = "XLM";

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    // 0.12 USDC per XLM in 14-decimal:
    //   7-decimal:  0.12 USDC = 1_200_000  (1.2 × 10^6)
    //   14-decimal: 1_200_000 × 10^7 = 12_000_000_000_000
    const PRICE_14DEC: i128 = 12_000_000_000_000; // 0.12 USDC
    const PRICE_7DEC: i128 = 1_200_000;           // 0.12 USDC in 7-decimal

    #[test]
    fn test_initialize_and_lastprice() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, MockOracle);
        let client = MockOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin, &PRICE_14DEC);

        let result = client.lastprice(&Asset::Other(symbol_short!("XLM")));
        assert!(result.is_some());
        assert_eq!(result.unwrap().price, PRICE_14DEC);
    }

    #[test]
    fn test_set_price() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, MockOracle);
        let client = MockOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin, &PRICE_14DEC);
        // 0.15 USDC in 14-dec
        client.set_price(&admin, &15_000_000_000_000);

        assert_eq!(client.price(), 15_000_000_000_000);
    }

    #[test]
    fn test_price_7dec_conversion() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, MockOracle);
        let client = MockOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        // 0.12 USDC = 12_000_000_000_000 (14-dec) = 1_200_000 (7-dec)
        client.initialize(&admin, &PRICE_14DEC);

        assert_eq!(client.price_7dec(), PRICE_7DEC);
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_double_initialize_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, MockOracle);
        let client = MockOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin, &PRICE_14DEC);
        client.initialize(&admin, &PRICE_14DEC);
    }

    #[test]
    fn test_any_asset_returns_xlm_price() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, MockOracle);
        let client = MockOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin, &PRICE_14DEC);

        // Both XLM and any other symbol return the same price
        let xlm = client.lastprice(&Asset::Other(symbol_short!("XLM")));
        let btc = client.lastprice(&Asset::Other(symbol_short!("BTC")));
        assert_eq!(xlm.unwrap().price, btc.unwrap().price);
    }
}
