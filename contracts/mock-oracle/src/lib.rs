//! MockOracle — Testnet price oracle implementing the DIA interface.
//!
//! Deployed on testnet as a stand-in for the DIA oracle. The admin can update
//! the XLM price at any time. The price is returned in 8-decimal format matching
//! the DIA oracle interface so the PricingEngine's oracle.rs conversion is exercised.
//!
//! Interface mirrors DIA oracle:
//!   get_value(key: String) -> OracleValue { price: u128, timestamp: u128 }

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, BytesN, Env, String,
};

// ── DIA-compatible types ───────────────────────────────────────────────────

/// Price data matching DIA oracle's return type.
#[contracttype]
#[derive(Clone, Debug)]
pub struct OracleValue {
    pub price: u128,
    pub timestamp: u128,
}

// ── Storage keys ────────────────────────────────────────────────────────────

#[contracttype]
enum DataKey {
    Admin,
    /// Stored in 8-decimal format (matching DIA: 1 USD = 10^8)
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
    /// `initial_price_8dec`: price in 8-decimal format.
    /// Example: 0.12 USDC per XLM = 12_000_000 (1.2 × 10^7)
    pub fn initialize(env: Env, admin: Address, initial_price_8dec: u128) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Price, &initial_price_8dec);
        env.storage().instance().set(&DataKey::Timestamp, &(env.ledger().timestamp() as u128));

        env.storage().instance().extend_ttl(100_000, 1_000_000);
    }

    /// Update the XLM/USD price. Only callable by admin.
    ///
    /// `price_8dec`: new price in 8-decimal format.
    pub fn set_price(env: Env, admin: Address, price_8dec: u128) {
        admin.require_auth();

        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin)
            .expect("not initialized");
        if admin != stored_admin {
            panic!("unauthorized");
        }

        env.storage().instance().set(&DataKey::Price, &price_8dec);
        env.storage().instance().set(&DataKey::Timestamp, &(env.ledger().timestamp() as u128));

        env.storage().instance().extend_ttl(100_000, 1_000_000);
    }

    /// Returns the current price for any key (always returns XLM/USD price).
    ///
    /// Matches the DIA oracle interface: `get_value(key: String) -> OracleValue`
    /// The PricingEngine calls this with key = "XLM/USD".
    pub fn get_value(env: Env, _key: String) -> OracleValue {
        env.storage().instance().extend_ttl(100_000, 1_000_000);

        let price: u128 = env.storage().instance().get(&DataKey::Price)
            .expect("not initialized");

        OracleValue {
            price,
            timestamp: env.ledger().timestamp() as u128,
        }
    }

    /// Upgrade the contract WASM in-place. Only callable by admin.
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

    /// Get the current price in 8-decimal format.
    pub fn price(env: Env) -> u128 {
        env.storage().instance().get(&DataKey::Price)
            .expect("not initialized")
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, String};

    // 0.12 USDC per XLM in 8-decimal: 0.12 * 10^8 = 12_000_000
    const PRICE_8DEC: u128 = 12_000_000;

    #[test]
    fn test_initialize_and_get_value() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, MockOracle);
        let client = MockOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin, &PRICE_8DEC);

        let key = String::from_str(&env, "XLM/USD");
        let result = client.get_value(&key);
        assert_eq!(result.price, PRICE_8DEC);
    }

    #[test]
    fn test_set_price() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, MockOracle);
        let client = MockOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin, &PRICE_8DEC);
        client.set_price(&admin, &15_000_000u128);

        assert_eq!(client.price(), 15_000_000u128);
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_double_initialize_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, MockOracle);
        let client = MockOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin, &PRICE_8DEC);
        client.initialize(&admin, &PRICE_8DEC);
    }

    #[test]
    fn test_any_key_returns_price() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, MockOracle);
        let client = MockOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin, &PRICE_8DEC);

        let xlm = client.get_value(&String::from_str(&env, "XLM/USD"));
        let btc = client.get_value(&String::from_str(&env, "BTC/USD"));
        assert_eq!(xlm.price, btc.price);
    }
}
