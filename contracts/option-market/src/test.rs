#![cfg(test)]

use super::*;
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{StellarAssetClient, TokenClient},
    Address, Env, Symbol, Vec,
};

// ─── Mock PricingEngine ───────────────────────────────────────────────────────

#[contract]
pub struct MockPricingEngine;

#[contracttype]
enum PeKey {
    Spot,
}

#[contractimpl]
impl MockPricingEngine {
    pub fn set_spot(env: Env, price: i128) {
        env.storage().instance().set(&PeKey::Spot, &price);
        env.storage().instance().extend_ttl(100_000, 10_000_000);
    }

    pub fn get_spot_price(env: Env) -> i128 {
        env.storage().instance().extend_ttl(100_000, 10_000_000);
        env.storage().instance().get(&PeKey::Spot).unwrap_or(1_200_000)
    }

    /// Returns a fixed 1% of strike as premium per contract.
    pub fn calc_call_premium(_env: Env, strike: i128, _expiry: u64, amount: u64) -> i128 {
        // 1% of strike * amount, minimum 100_000
        let unit = strike / 100;
        (unit * amount as i128).max(100_000)
    }

    pub fn calc_put_premium(_env: Env, strike: i128, _expiry: u64, amount: u64) -> i128 {
        let unit = strike / 100;
        (unit * amount as i128).max(100_000)
    }
}

// ─── Mock Oracle (for settlement) ────────────────────────────────────────────

#[contract]
pub struct MockOracle;

#[contracttype]
enum OracleKey {
    Price,
    Ts,
}

#[contractimpl]
impl MockOracle {
    pub fn set_price(env: Env, price: i128, ts: u64) {
        env.storage().instance().set(&OracleKey::Price, &price);
        env.storage().instance().set(&OracleKey::Ts, &ts);
        env.storage().instance().extend_ttl(100_000, 10_000_000);
    }

    /// Reflector-compatible interface: price in 14-decimal, returns Option<PriceData>.
    pub fn lastprice(env: Env, _asset: crate::OptionMarketAsset) -> Option<crate::OptionMarketPriceData> {
        env.storage().instance().extend_ttl(100_000, 10_000_000);
        let price: i128 = env.storage().instance().get(&OracleKey::Price).unwrap_or(0);
        let timestamp: u64 = env.storage().instance().get(&OracleKey::Ts).unwrap_or(0);
        Some(crate::OptionMarketPriceData { price, timestamp })
    }
}

// ─── Test Helpers ─────────────────────────────────────────────────────────────

const SCALE: i128 = 10_000_000;

fn to_usdc(f: f64) -> i128 {
    (f * SCALE as f64).round() as i128
}

fn to_float(x: i128) -> f64 {
    x as f64 / SCALE as f64
}

const CONTRACT_SIZE: u64 = 10_000_000; // 1 XLM per contract

/// Base ledger time.
const BASE_TIME: u64 = 1_700_000_000;

/// 7-day expiry.
fn expiry_7d() -> u64 {
    BASE_TIME + 7 * 86_400
}

struct TestCtx {
    env: Env,
    market: OptionMarketClient<'static>,
    vault_id: Address,
    usdc_id: Address,
    admin: Address,
    pe_id: Address,
    oracle_id: Address,
}

fn setup() -> TestCtx {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().set(LedgerInfo {
        timestamp: BASE_TIME,
        protocol_version: 21,
        sequence_number: 100,
        network_id: Default::default(),
        base_reserve: 5_000_000,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 10_000_000,
    });

    let admin = Address::generate(&env);

    // USDC token
    let usdc_admin = Address::generate(&env);
    let usdc_id = env.register_stellar_asset_contract(usdc_admin.clone());
    let usdc_sac = StellarAssetClient::new(&env, &usdc_id);

    // Mock PricingEngine
    let pe_id = env.register_contract(None, MockPricingEngine);
    MockPricingEngineClient::new(&env, &pe_id).set_spot(&to_usdc(0.12));

    // Mock Oracle (Reflector 14-decimal: 0.12 * 10^14 = 12_000_000_000_000)
    let oracle_id = env.register_contract(None, MockOracle);
    MockOracleClient::new(&env, &oracle_id).set_price(&12_000_000_000_000i128, &BASE_TIME);

    // Vault
    let vault_id = env.register_contract(None, underwriting_vault_module::UnderwritingVault);
    let vault = underwriting_vault_module::UnderwritingVaultClient::new(&env, &vault_id);

    // Seed vault with 100k USDC liquidity
    usdc_sac.mint(&admin, &to_usdc(200_000.0));
    vault.initialize(&admin, &usdc_id, &to_usdc(1_000_000.0));
    vault.deposit(&admin, &to_usdc(100_000.0));

    // OptionMarket
    let market_id = env.register_contract(None, OptionMarket);
    let market = OptionMarketClient::new(&env, &market_id);

    market.initialize(
        &admin,
        &pe_id,
        &vault_id,
        &usdc_id,
        &oracle_id,
        &CONTRACT_SIZE,
    );

    // Wire vault to market
    vault.set_option_market(&admin, &market_id);

    // Create epoch
    market.create_epoch(&admin, &expiry_7d());

    TestCtx {
        env,
        market,
        vault_id,
        usdc_id,
        admin,
        pe_id,
        oracle_id,
    }
}

fn mint_usdc(env: &Env, usdc_id: &Address, to: &Address, amount: i128) {
    let sac = StellarAssetClient::new(env, usdc_id);
    sac.mint(to, &amount);
}

// Import the vault module for cross-contract testing
mod underwriting_vault_module {
    pub use underwriting_vault::*;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[test]
fn test_initialize() {
    let ctx = setup();
    let config = ctx.market.get_config();
    assert_eq!(config.paused, false);
    assert_eq!(config.next_position_id, 0);
    assert_eq!(config.contract_size, CONTRACT_SIZE);
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_initialize_twice_fails() {
    let ctx = setup();
    let admin2 = Address::generate(&ctx.env);
    ctx.market.initialize(
        &admin2,
        &ctx.pe_id,
        &ctx.vault_id,
        &ctx.usdc_id,
        &ctx.oracle_id,
        &CONTRACT_SIZE,
    );
}

#[test]
fn test_create_epoch() {
    let ctx = setup();
    let strikes = ctx.market.get_strikes(&expiry_7d());
    // Should have 9 strikes: ATM + 4 pairs (±5%, ±10%, ±15%, ±20%)
    assert_eq!(strikes.len(), 9, "Expected 9 strikes");

    // Premiums are 0 in stored StrikeInfo — they are fetched live via get_premium / buy_*.
    // Verify strikes span the correct range (ATM ± 5/10/15/20%).
    let spot = to_usdc(0.12); // same value set in setup()
    let has_atm = strikes.iter().any(|s| s.strike == spot);
    assert!(has_atm, "ATM strike missing");
    // All strike prices must be positive; premiums stored as 0
    for s in strikes.iter() {
        assert!(s.strike > 0, "Strike price must be positive");
        assert_eq!(s.call_premium, 0, "Premiums are computed live, not cached");
        assert_eq!(s.put_premium, 0, "Premiums are computed live, not cached");
    }
}

#[test]
#[should_panic(expected = "epoch already exists")]
fn test_create_epoch_duplicate_fails() {
    let ctx = setup();
    ctx.market.create_epoch(&ctx.admin, &expiry_7d());
}

#[test]
fn test_buy_call_success() {
    let ctx = setup();

    let buyer = Address::generate(&ctx.env);
    mint_usdc(&ctx.env, &ctx.usdc_id, &buyer, to_usdc(1000.0));

    let spot = to_usdc(0.12);
    let pos_id = ctx.market.buy_call(&buyer, &spot, &expiry_7d(), &1u64);

    assert_eq!(pos_id, 0);

    let pos = ctx.market.get_position(&pos_id);
    assert_eq!(pos.owner, buyer);
    assert_eq!(pos.strike, spot);
    assert_eq!(pos.amount, 1);
    assert!(!pos.settled);
    assert!(pos.premium_paid > 0);
    assert!(pos.locked_amount > 0);
}

#[test]
fn test_buy_put_success() {
    let ctx = setup();

    let buyer = Address::generate(&ctx.env);
    mint_usdc(&ctx.env, &ctx.usdc_id, &buyer, to_usdc(1000.0));

    let spot = to_usdc(0.12);
    let pos_id = ctx.market.buy_put(&buyer, &spot, &expiry_7d(), &1u64);

    assert_eq!(pos_id, 0);

    let pos = ctx.market.get_position(&pos_id);
    assert_eq!(pos.owner, buyer);
    assert!(!pos.settled);
}

#[test]
fn test_position_ids_increment() {
    let ctx = setup();

    let buyer = Address::generate(&ctx.env);
    mint_usdc(&ctx.env, &ctx.usdc_id, &buyer, to_usdc(10_000.0));

    let spot = to_usdc(0.12);
    let id0 = ctx.market.buy_call(&buyer, &spot, &expiry_7d(), &1u64);
    let id1 = ctx.market.buy_put(&buyer, &spot, &expiry_7d(), &1u64);
    let id2 = ctx.market.buy_call(&buyer, &spot, &expiry_7d(), &1u64);

    assert_eq!(id0, 0);
    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
}

#[test]
fn test_user_positions_tracked() {
    let ctx = setup();

    let buyer = Address::generate(&ctx.env);
    mint_usdc(&ctx.env, &ctx.usdc_id, &buyer, to_usdc(10_000.0));

    let spot = to_usdc(0.12);
    ctx.market.buy_call(&buyer, &spot, &expiry_7d(), &1u64);
    ctx.market.buy_put(&buyer, &spot, &expiry_7d(), &1u64);

    let positions = ctx.market.get_user_positions(&buyer);
    assert_eq!(positions.len(), 2);
}

#[test]
#[should_panic(expected = "market paused")]
fn test_pause_blocks_buying() {
    let ctx = setup();
    ctx.market.set_paused(&ctx.admin, &true);

    let buyer = Address::generate(&ctx.env);
    mint_usdc(&ctx.env, &ctx.usdc_id, &buyer, to_usdc(1000.0));
    ctx.market.buy_call(&buyer, &to_usdc(0.12), &expiry_7d(), &1u64);
}

#[test]
fn test_unpause_allows_buying() {
    let ctx = setup();
    ctx.market.set_paused(&ctx.admin, &true);
    ctx.market.set_paused(&ctx.admin, &false);

    let buyer = Address::generate(&ctx.env);
    mint_usdc(&ctx.env, &ctx.usdc_id, &buyer, to_usdc(1000.0));
    let pos_id = ctx.market.buy_call(&buyer, &to_usdc(0.12), &expiry_7d(), &1u64);
    assert_eq!(pos_id, 0);
}

#[test]
#[should_panic(expected = "invalid strike for this expiry")]
fn test_invalid_strike_rejected() {
    let ctx = setup();

    let buyer = Address::generate(&ctx.env);
    mint_usdc(&ctx.env, &ctx.usdc_id, &buyer, to_usdc(1000.0));

    // Strike not in epoch
    ctx.market.buy_call(&buyer, &to_usdc(0.99), &expiry_7d(), &1u64);
}

#[test]
#[should_panic(expected = "expiry must be in the future")]
fn test_expired_option_rejected() {
    let ctx = setup();

    let buyer = Address::generate(&ctx.env);
    mint_usdc(&ctx.env, &ctx.usdc_id, &buyer, to_usdc(1000.0));

    ctx.market.buy_call(&buyer, &to_usdc(0.12), &(BASE_TIME - 1), &1u64);
}

#[test]
fn test_settle_itm_call() {
    let ctx = setup();

    let buyer = Address::generate(&ctx.env);
    mint_usdc(&ctx.env, &ctx.usdc_id, &buyer, to_usdc(1000.0));

    let strike = to_usdc(0.12); // ATM
    ctx.market.buy_call(&buyer, &strike, &expiry_7d(), &1u64);

    // Advance past expiry
    ctx.env.ledger().set(LedgerInfo {
        timestamp: expiry_7d() + 100,
        protocol_version: 21,
        sequence_number: 200,
        network_id: Default::default(),
        base_reserve: 5_000_000,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 10_000_000,
    });

    // Set settlement price to 0.15 (ITM for call with strike 0.12)
    // Reflector 14-decimal: 0.15 * 10^14 = 15_000_000_000_000
    MockOracleClient::new(&ctx.env, &ctx.oracle_id)
        .set_price(&15_000_000_000_000i128, &(expiry_7d() + 100));

    ctx.market.settle(&ctx.admin, &expiry_7d());

    assert!(ctx.market.is_settled(&expiry_7d()));

    let pos = ctx.market.get_position(&0u64);
    assert!(pos.settled);
    // Payout: (0.15 - 0.12) * 1 XLM = 0.03 USDC
    assert!(pos.payout > 0, "ITM call should have payout");
    let payout_f = to_float(pos.payout);
    assert!((payout_f - 0.03).abs() < 0.001, "Call payout = {}", payout_f);
}

#[test]
fn test_settle_otm_call() {
    let ctx = setup();

    let buyer = Address::generate(&ctx.env);
    mint_usdc(&ctx.env, &ctx.usdc_id, &buyer, to_usdc(1000.0));

    let strike = to_usdc(0.12);
    ctx.market.buy_call(&buyer, &strike, &expiry_7d(), &1u64);

    // Advance past expiry
    ctx.env.ledger().set(LedgerInfo {
        timestamp: expiry_7d() + 100,
        protocol_version: 21,
        sequence_number: 200,
        network_id: Default::default(),
        base_reserve: 5_000_000,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 10_000_000,
    });

    // Settlement price below strike (OTM for call) — 0.10 USD
    MockOracleClient::new(&ctx.env, &ctx.oracle_id)
        .set_price(&10_000_000_000_000i128, &(expiry_7d() + 100));

    ctx.market.settle(&ctx.admin, &expiry_7d());

    let pos = ctx.market.get_position(&0u64);
    assert!(pos.settled);
    assert_eq!(pos.payout, 0, "OTM call should have zero payout");
    assert!(pos.claimed, "OTM should be auto-claimed");
}

#[test]
fn test_settle_itm_put() {
    let ctx = setup();

    let buyer = Address::generate(&ctx.env);
    mint_usdc(&ctx.env, &ctx.usdc_id, &buyer, to_usdc(1000.0));

    let strike = to_usdc(0.12);
    ctx.market.buy_put(&buyer, &strike, &expiry_7d(), &1u64);

    ctx.env.ledger().set(LedgerInfo {
        timestamp: expiry_7d() + 100,
        protocol_version: 21,
        sequence_number: 200,
        network_id: Default::default(),
        base_reserve: 5_000_000,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 10_000_000,
    });

    // Settlement at 0.09 (below strike → ITM put)
    MockOracleClient::new(&ctx.env, &ctx.oracle_id)
        .set_price(&9_000_000_000_000i128, &(expiry_7d() + 100));

    ctx.market.settle(&ctx.admin, &expiry_7d());

    let pos = ctx.market.get_position(&0u64);
    assert!(pos.settled);
    let payout_f = to_float(pos.payout);
    // (0.12 - 0.09) * 1 = 0.03
    assert!((payout_f - 0.03).abs() < 0.001, "Put ITM payout = {}", payout_f);
}

#[test]
#[should_panic(expected = "already settled")]
fn test_double_settle_fails() {
    let ctx = setup();

    ctx.env.ledger().set(LedgerInfo {
        timestamp: expiry_7d() + 100,
        protocol_version: 21,
        sequence_number: 200,
        network_id: Default::default(),
        base_reserve: 5_000_000,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 10_000_000,
    });
    MockOracleClient::new(&ctx.env, &ctx.oracle_id)
        .set_price(&12_000_000_000_000i128, &(expiry_7d() + 100));

    ctx.market.settle(&ctx.admin, &expiry_7d());
    ctx.market.settle(&ctx.admin, &expiry_7d()); // should panic
}

#[test]
#[should_panic(expected = "expiry has not passed")]
fn test_settle_before_expiry_fails() {
    let ctx = setup();
    ctx.market.settle(&ctx.admin, &expiry_7d());
}

#[test]
fn test_claim_itm_marks_claimed() {
    let ctx = setup();

    let buyer = Address::generate(&ctx.env);
    mint_usdc(&ctx.env, &ctx.usdc_id, &buyer, to_usdc(1000.0));

    let strike = to_usdc(0.12);
    let pos_id = ctx.market.buy_call(&buyer, &strike, &expiry_7d(), &1u64);

    ctx.env.ledger().set(LedgerInfo {
        timestamp: expiry_7d() + 100,
        protocol_version: 21,
        sequence_number: 200,
        network_id: Default::default(),
        base_reserve: 5_000_000,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 10_000_000,
    });
    MockOracleClient::new(&ctx.env, &ctx.oracle_id)
        .set_price(&15_000_000_000_000i128, &(expiry_7d() + 100));

    ctx.market.settle(&ctx.admin, &expiry_7d());

    // Position has ITM payout — claim it
    ctx.market.claim(&buyer, &pos_id);

    let pos = ctx.market.get_position(&pos_id);
    assert!(pos.claimed);
}

#[test]
#[should_panic(expected = "already claimed")]
fn test_claim_otm_fails() {
    let ctx = setup();

    let buyer = Address::generate(&ctx.env);
    mint_usdc(&ctx.env, &ctx.usdc_id, &buyer, to_usdc(1000.0));

    let strike = to_usdc(0.12);
    let pos_id = ctx.market.buy_call(&buyer, &strike, &expiry_7d(), &1u64);

    ctx.env.ledger().set(LedgerInfo {
        timestamp: expiry_7d() + 100,
        protocol_version: 21,
        sequence_number: 200,
        network_id: Default::default(),
        base_reserve: 5_000_000,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 10_000_000,
    });
    MockOracleClient::new(&ctx.env, &ctx.oracle_id)
        .set_price(&10_000_000_000_000i128, &(expiry_7d() + 100));

    ctx.market.settle(&ctx.admin, &expiry_7d());
    ctx.market.claim(&buyer, &pos_id); // OTM → should panic
}

#[test]
#[should_panic(expected = "already claimed")]
fn test_double_claim_fails() {
    let ctx = setup();

    let buyer = Address::generate(&ctx.env);
    mint_usdc(&ctx.env, &ctx.usdc_id, &buyer, to_usdc(1000.0));

    let pos_id = ctx.market.buy_call(&buyer, &to_usdc(0.12), &expiry_7d(), &1u64);

    ctx.env.ledger().set(LedgerInfo {
        timestamp: expiry_7d() + 100,
        protocol_version: 21,
        sequence_number: 200,
        network_id: Default::default(),
        base_reserve: 5_000_000,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 10_000_000,
    });
    MockOracleClient::new(&ctx.env, &ctx.oracle_id)
        .set_price(&15_000_000_000_000i128, &(expiry_7d() + 100));

    ctx.market.settle(&ctx.admin, &expiry_7d());
    ctx.market.claim(&buyer, &pos_id);
    ctx.market.claim(&buyer, &pos_id); // second claim → panic
}

#[test]
#[should_panic(expected = "not position owner")]
fn test_claim_wrong_owner_fails() {
    let ctx = setup();

    let buyer = Address::generate(&ctx.env);
    let attacker = Address::generate(&ctx.env);
    mint_usdc(&ctx.env, &ctx.usdc_id, &buyer, to_usdc(1000.0));

    let pos_id = ctx.market.buy_call(&buyer, &to_usdc(0.12), &expiry_7d(), &1u64);

    ctx.env.ledger().set(LedgerInfo {
        timestamp: expiry_7d() + 100,
        protocol_version: 21,
        sequence_number: 200,
        network_id: Default::default(),
        base_reserve: 5_000_000,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 10_000_000,
    });
    MockOracleClient::new(&ctx.env, &ctx.oracle_id)
        .set_price(&15_000_000_000_000i128, &(expiry_7d() + 100));

    ctx.market.settle(&ctx.admin, &expiry_7d());
    ctx.market.claim(&attacker, &pos_id);
}

#[test]
fn test_get_premium_quote() {
    let ctx = setup();
    let strike = to_usdc(0.12);
    let premium = ctx.market.get_premium(
        &OptionType::Call,
        &strike,
        &expiry_7d(),
        &1u64,
    );
    assert!(premium > 0, "Premium quote must be positive");
}

#[test]
fn test_is_settled_false_before_settlement() {
    let ctx = setup();
    assert!(!ctx.market.is_settled(&expiry_7d()));
}

#[test]
fn test_is_settled_true_after_settlement() {
    let ctx = setup();

    ctx.env.ledger().set(LedgerInfo {
        timestamp: expiry_7d() + 100,
        protocol_version: 21,
        sequence_number: 200,
        network_id: Default::default(),
        base_reserve: 5_000_000,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 10_000_000,
    });
    MockOracleClient::new(&ctx.env, &ctx.oracle_id)
        .set_price(&12_000_000_000_000i128, &(expiry_7d() + 100));

    ctx.market.settle(&ctx.admin, &expiry_7d());
    assert!(ctx.market.is_settled(&expiry_7d()));
}

#[test]
#[should_panic(expected = "unauthorized")]
fn test_set_paused_non_admin_fails() {
    let ctx = setup();
    let non_admin = Address::generate(&ctx.env);
    ctx.market.set_paused(&non_admin, &true);
}

#[test]
fn test_multiple_positions_correct_settlement() {
    let ctx = setup();

    let buyer = Address::generate(&ctx.env);
    mint_usdc(&ctx.env, &ctx.usdc_id, &buyer, to_usdc(10_000.0));

    let strike = to_usdc(0.12);

    // Buy 2 calls and 1 put
    let call_id1 = ctx.market.buy_call(&buyer, &strike, &expiry_7d(), &1u64);
    let call_id2 = ctx.market.buy_call(&buyer, &strike, &expiry_7d(), &2u64);
    let put_id = ctx.market.buy_put(&buyer, &strike, &expiry_7d(), &1u64);

    ctx.env.ledger().set(LedgerInfo {
        timestamp: expiry_7d() + 100,
        protocol_version: 21,
        sequence_number: 200,
        network_id: Default::default(),
        base_reserve: 5_000_000,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 10_000_000,
    });
    // Settlement at 0.15 → calls ITM, put OTM
    MockOracleClient::new(&ctx.env, &ctx.oracle_id)
        .set_price(&15_000_000_000_000i128, &(expiry_7d() + 100));

    ctx.market.settle(&ctx.admin, &expiry_7d());

    let pos_c1 = ctx.market.get_position(&call_id1);
    let pos_c2 = ctx.market.get_position(&call_id2);
    let pos_put = ctx.market.get_position(&put_id);

    // Call payouts: (0.15-0.12)*1 = 0.03, (0.15-0.12)*2 = 0.06
    assert!((to_float(pos_c1.payout) - 0.03).abs() < 0.001);
    assert!((to_float(pos_c2.payout) - 0.06).abs() < 0.001);
    // Put OTM → 0
    assert_eq!(pos_put.payout, 0);
}
