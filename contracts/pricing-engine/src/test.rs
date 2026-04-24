#![cfg(test)]

use super::*;
use soroban_sdk::{
    contract, contractimpl, contracttype,
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, Env,
};

// ─── Mock Oracle ──────────────────────────────────────────────────────────────

/// A mock Reflector oracle that returns a configurable price.
#[contract]
pub struct MockOracle;

/// Storage key for mock oracle price data.
#[contracttype]
enum MockKey {
    Price,
    Timestamp,
}

#[contractimpl]
impl MockOracle {
    pub fn set_price(env: Env, price: i128, timestamp: u64) {
        env.storage().instance().set(&MockKey::Price, &price);
        env.storage().instance().set(&MockKey::Timestamp, &timestamp);
    }

    /// Matches Reflector's `lastprice(asset)` interface.
    pub fn lastprice(env: Env, _asset: crate::oracle::Asset) -> Option<crate::oracle::PriceData> {
        let price: Option<i128> = env.storage().instance().get(&MockKey::Price);
        let timestamp: Option<u64> = env.storage().instance().get(&MockKey::Timestamp);
        match (price, timestamp) {
            (Some(p), Some(ts)) => Some(crate::oracle::PriceData {
                price: p,
                timestamp: ts,
            }),
            _ => None,
        }
    }
}

// ─── Test Helpers ─────────────────────────────────────────────────────────────

fn to_fixed(f: f64) -> i128 {
    (f * 10_000_000.0).round() as i128
}

fn to_float(x: i128) -> f64 {
    x as f64 / 10_000_000.0
}

/// Standard test setup: create env, register contracts, set ledger time.
/// Returns (env, pricing_client, oracle_address, admin_address).
fn setup() -> (Env, PricingEngineClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    // Set ledger timestamp to a known time
    env.ledger().set(LedgerInfo {
        timestamp: 1_700_000_000,
        protocol_version: 21,
        sequence_number: 100,
        network_id: Default::default(),
        base_reserve: 5_000_000,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 10_000_000,
    });

    let admin = Address::generate(&env);
    let pricing_id = env.register_contract(None, PricingEngine);
    let oracle_id = env.register_contract(None, MockOracle);

    // Set oracle price: 0.12 USDC per XLM
    // Reflector 14-decimal: 0.12 * 10^14 = 12_000_000_000_000
    MockOracleClient::new(&env, &oracle_id).set_price(
        &12_000_000_000_000i128,
        &1_700_000_000u64,
    );

    let client = PricingEngineClient::new(&env, &pricing_id);

    client.initialize(
        &admin,
        &oracle_id,
        &8000u64,  // 80% IV
        &100u64,   // 1% spread
    );

    (env, client, oracle_id, admin)
}

/// Expiry 7 days from ledger start (1_700_000_000 + 7*86400).
fn expiry_7d() -> u64 {
    1_700_000_000 + 7 * 86_400
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[test]
fn test_initialize() {
    let (_env, client, _oracle, _admin) = setup();
    let cfg = client.get_config();
    assert!(cfg.initialized);
    assert_eq!(cfg.iv_bps, 8000);
    assert_eq!(cfg.spread_bps, 100);
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_initialize_twice_fails() {
    let (env, client, oracle, _admin) = setup();
    let admin2 = Address::generate(&env);
    client.initialize(&admin2, &oracle, &8000u64, &100u64);
}

#[test]
fn test_call_premium_atm() {
    // ATM call: S=K=0.12, T=7d, σ=80%
    let (_env, client, _oracle, _admin) = setup();
    let strike = to_fixed(0.12); // ATM
    let expiry = expiry_7d();
    let premium = client.calc_call_premium(&strike, &expiry, &1u64);
    let premium_f = to_float(premium);
    // Python bs_call(0.12, 0.12, 7/365, 0.80) ≈ 0.00748; with 1% spread ≈ 0.00756
    assert!(
        premium_f > 0.004 && premium_f < 0.015,
        "ATM call premium = {}, expected 0.004..0.015",
        premium_f
    );
}

#[test]
fn test_put_premium_atm() {
    // ATM put: S=K=0.12
    let (_env, client, _oracle, _admin) = setup();
    let strike = to_fixed(0.12);
    let expiry = expiry_7d();
    let premium = client.calc_put_premium(&strike, &expiry, &1u64);
    let premium_f = to_float(premium);
    assert!(
        premium_f > 0.004 && premium_f < 0.015,
        "ATM put premium = {}",
        premium_f
    );
}

#[test]
fn test_put_call_parity() {
    // C - P ≈ S - K (r=0, European), ATM so C ≈ P
    let (_env, client, _oracle, _admin) = setup();
    let spot = to_fixed(0.12);
    let strike = to_fixed(0.12);
    let expiry = expiry_7d();

    let call = client.calc_call_premium(&strike, &expiry, &1u64);
    let put = client.calc_put_premium(&strike, &expiry, &1u64);

    // Spread is applied symmetrically so parity should hold within rounding
    let diff = to_float((call - put).abs());
    // C - P = S - K = 0 for ATM; allow 0.2% tolerance
    assert!(
        diff < 0.0005,
        "Put-call parity: C={}, P={}, |C-P|={}",
        to_float(call),
        to_float(put),
        diff
    );
}

#[test]
fn test_deep_itm_call() {
    // Deep ITM call: S=0.12, K=0.06 (50% below spot)
    let (_env, client, _oracle, _admin) = setup();
    let spot = to_fixed(0.12);
    let strike = to_fixed(0.06);
    let expiry = expiry_7d();

    let premium = client.calc_call_premium(&strike, &expiry, &1u64);
    let intrinsic = spot - strike; // 0.06

    // Premium must be >= intrinsic (no arbitrage)
    assert!(
        premium >= intrinsic,
        "Deep ITM call premium {} < intrinsic {}",
        to_float(premium),
        to_float(intrinsic)
    );
    // Time value should be small
    let time_val = to_float(premium - intrinsic);
    assert!(time_val < 0.01, "Unexpected large time value: {}", time_val);
}

#[test]
fn test_deep_otm_call() {
    // Deep OTM call: S=0.12, K=0.24 (2x spot)
    // BS price approaches zero → floored at MIN_PREMIUM (0.01 USDC = 100_000)
    let (_env, client, _oracle, _admin) = setup();
    let strike = to_fixed(0.24);
    let expiry = expiry_7d();

    let premium = client.calc_call_premium(&strike, &expiry, &1u64);

    // Deep OTM: BS price is near zero, so MIN_PREMIUM floor kicks in
    // Premium should be exactly MIN_PREMIUM (100_000 = 0.01 USDC)
    assert_eq!(
        premium, 100_000,
        "Deep OTM call should hit MIN_PREMIUM floor, got {}",
        to_float(premium)
    );
}

#[test]
fn test_deep_itm_put() {
    // Deep ITM put: S=0.12, K=0.24
    let (_env, client, _oracle, _admin) = setup();
    let spot = to_fixed(0.12);
    let strike = to_fixed(0.24);
    let expiry = expiry_7d();

    let premium = client.calc_put_premium(&strike, &expiry, &1u64);
    let intrinsic = strike - spot; // 0.12

    assert!(
        premium >= intrinsic,
        "Deep ITM put premium {} < intrinsic {}",
        to_float(premium),
        to_float(intrinsic)
    );
}

#[test]
fn test_deep_otm_put() {
    // Deep OTM put: S=0.12, K=0.06 (50% below spot)
    // BS price is near zero → floored at MIN_PREMIUM (0.01 USDC)
    let (_env, client, _oracle, _admin) = setup();
    let strike = to_fixed(0.06);
    let expiry = expiry_7d();

    let premium = client.calc_put_premium(&strike, &expiry, &1u64);

    assert_eq!(
        premium, 100_000,
        "Deep OTM put should hit MIN_PREMIUM floor, got {}",
        to_float(premium)
    );
}

#[test]
fn test_near_expiry_decay() {
    // Premium decreases as expiry approaches.
    // Use 100 contracts to push above MIN_PREMIUM floor and reveal decay.
    let (_env, client, _oracle, _admin) = setup();
    let strike = to_fixed(0.12); // ATM

    let premium_7d = client.calc_call_premium(&strike, &expiry_7d(), &100u64);
    let premium_1d = client.calc_call_premium(&strike, &(1_700_000_000 + 86_400), &100u64);

    assert!(
        premium_7d > premium_1d,
        "7d total premium {} should > 1d total premium {}",
        to_float(premium_7d),
        to_float(premium_1d)
    );
}

#[test]
fn test_zero_time_intrinsic() {
    // At or past expiry: premium = intrinsic value
    let (_env, client, _oracle, _admin) = setup();
    let spot = to_fixed(0.12);
    let strike_itm = to_fixed(0.10); // ITM call
    let expiry_past = 1_700_000_000 - 1; // 1 second before ledger time

    let call = client.calc_call_premium(&strike_itm, &expiry_past, &1u64);
    let intrinsic = spot - strike_itm; // 0.02

    // Should equal intrinsic or MIN_PREMIUM, whichever is larger
    let expected = intrinsic.max(100_000);
    assert_eq!(
        call, expected,
        "At-expiry call: got {}, expected {}",
        to_float(call),
        to_float(expected)
    );
}

#[test]
fn test_spread_applied() {
    // Premium with 10% spread should be ~10% higher than no-spread
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set(LedgerInfo {
        timestamp: 1_700_000_000,
        protocol_version: 21,
        sequence_number: 100,
        network_id: Default::default(),
        base_reserve: 5_000_000,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 10_000_000,
    });

    let oracle_id = env.register_contract(None, MockOracle);
    MockOracleClient::new(&env, &oracle_id).set_price(
        &12_000_000_000_000i128,
        &1_700_000_000u64,
    );

    // No spread
    let admin_a = Address::generate(&env);
    let id_no = env.register_contract(None, PricingEngine);
    let client_no = PricingEngineClient::new(&env, &id_no);
    client_no.initialize(&admin_a, &oracle_id, &8000u64, &0u64);

    // 10% spread
    let admin_b = Address::generate(&env);
    let id_spread = env.register_contract(None, PricingEngine);
    let client_s = PricingEngineClient::new(&env, &id_spread);
    client_s.initialize(&admin_b, &oracle_id, &8000u64, &1000u64);

    // Use ITM strike and large amount to exceed MIN_PREMIUM floor
    let strike = to_fixed(0.10); // ITM
    let expiry = expiry_7d();

    let p_no = client_no.calc_call_premium(&strike, &expiry, &10u64);
    let p_sp = client_s.calc_call_premium(&strike, &expiry, &10u64);

    assert!(p_sp > p_no, "Spread premium must be higher");
    let ratio = to_float(p_sp) / to_float(p_no);
    assert!(
        (ratio - 1.10).abs() < 0.02,
        "Spread ratio = {}, expected ≈ 1.10",
        ratio
    );
}

#[test]
#[should_panic(expected = "unauthorized")]
fn test_set_iv_admin_only() {
    let (env, client, _oracle, _admin) = setup();
    let non_admin = Address::generate(&env);
    // non_admin is not the real admin → must panic with "unauthorized"
    client.set_iv(&non_admin, &9000u64);
}

#[test]
fn test_set_iv_updates_pricing() {
    let (_env, client, _oracle, admin) = setup();

    // Use ITM strike and multiple contracts to stay above MIN_PREMIUM
    let strike = to_fixed(0.10); // ITM call, S=0.12
    let expiry = expiry_7d();

    let premium_80 = client.calc_call_premium(&strike, &expiry, &10u64);

    client.set_iv(&admin, &12000u64); // 120% IV

    let premium_120 = client.calc_call_premium(&strike, &expiry, &10u64);

    assert!(
        premium_120 > premium_80,
        "Higher IV should increase premium: {} > {}",
        to_float(premium_120),
        to_float(premium_80)
    );
}

#[test]
fn test_minimum_premium_floor() {
    // Deep OTM: premium must still be >= MIN_PREMIUM (0.01 USDC = 100_000)
    let (_env, client, _oracle, _admin) = setup();
    let strike = to_fixed(1.0); // way OTM (spot = 0.12)
    let expiry = expiry_7d();

    let premium = client.calc_call_premium(&strike, &expiry, &1u64);
    assert!(
        premium >= 100_000,
        "Premium {} below MIN_PREMIUM floor",
        to_float(premium)
    );
}

#[test]
fn test_amount_scales_premium() {
    // Buying N contracts scales linearly with amount.
    // Use ITM call (S=0.12, K=0.10) so per-unit premium > MIN_PREMIUM.
    // BS gives ~0.020 USDC per contract → well above 0.01 floor.
    let (_env, client, _oracle, _admin) = setup();
    let strike = to_fixed(0.10); // ITM call
    let expiry = expiry_7d();

    let p1 = client.calc_call_premium(&strike, &expiry, &1u64);
    let p5 = client.calc_call_premium(&strike, &expiry, &5u64);

    // Both p1 and p5 should be well above MIN_PREMIUM
    assert!(p1 > 100_000, "ITM single contract premium should exceed MIN_PREMIUM");
    assert_eq!(p5, p1 * 5, "5-contract premium should be exactly 5x single");
}

#[test]
fn test_get_spot_price() {
    let (_env, client, _oracle, _admin) = setup();
    let spot = client.get_spot_price();
    // Oracle set: 0.12 USDC (14-dec: 12_000_000_000_000 → 7-dec: 1_200_000)
    let expected = to_fixed(0.12);
    assert_eq!(spot, expected, "Spot price: {} != {}", to_float(spot), to_float(expected));
}

#[test]
fn test_put_itm_greater_than_call_otm() {
    // When K > S: put is ITM, call is OTM → put premium > call premium
    let (_env, client, _oracle, _admin) = setup();
    let strike = to_fixed(0.20); // above spot 0.12
    let expiry = expiry_7d();

    let call = client.calc_call_premium(&strike, &expiry, &1u64);
    let put = client.calc_put_premium(&strike, &expiry, &1u64);

    assert!(
        put > call,
        "ITM put {} should > OTM call {}",
        to_float(put),
        to_float(call)
    );
}
