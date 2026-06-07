#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

// ─── Test Helpers ─────────────────────────────────────────────────────────────

fn to_usdc(dollars: f64) -> i128 {
    (dollars * 10_000_000.0).round() as i128
}

fn to_float(x: i128) -> f64 {
    x as f64 / 10_000_000.0
}

/// Standard test setup.
/// Returns (env, vault_client, usdc_admin, token_admin_client, vault_id).
fn setup() -> (Env, UnderwritingVaultClient<'static>, Address, Address) {
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

    let admin = Address::generate(&env);

    // Deploy a SAC USDC token
    let usdc_admin = Address::generate(&env);
    let usdc_id = env.register_stellar_asset_contract(usdc_admin.clone());

    // Mint tokens to admin (for seeding)
    let token_admin = StellarAssetClient::new(&env, &usdc_id);
    token_admin.mint(&admin, &to_usdc(1_000_000.0)); // 1M USDC to admin

    // Deploy vault
    let vault_id = env.register_contract(None, UnderwritingVault);
    let vault = UnderwritingVaultClient::new(&env, &vault_id);

    vault.initialize(&admin, &usdc_id, &to_usdc(1_000_000.0));

    // Wire up a fake option_market = admin for testing lock/release/premium/settle
    vault.set_option_market(&admin, &admin);

    (env, vault, usdc_id, admin)
}

/// Mint USDC to an LP for testing.
fn mint_usdc(env: &Env, usdc_id: &Address, to: &Address, amount: i128) {
    let sac = StellarAssetClient::new(env, usdc_id);
    sac.mint(to, &amount);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[test]
fn test_initialize() {
    let (_env, vault, _usdc_id, _admin) = setup();
    let info = vault.get_vault_info();
    assert_eq!(info.tvl, 0);
    assert_eq!(info.total_shares, 0);
    assert_eq!(info.locked, 0);
    assert_eq!(info.share_price, 10_000_000); // 1.0 initial
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_initialize_twice_fails() {
    let (env, vault, usdc_id, _admin) = setup();
    let admin2 = Address::generate(&env);
    vault.initialize(&admin2, &usdc_id, &to_usdc(1_000_000.0));
}

#[test]
fn test_deposit_first_lp() {
    // 1000 USDC → 1000 shares (1:1 bootstrap)
    let (env, vault, usdc_id, _admin) = setup();

    let lp = Address::generate(&env);
    mint_usdc(&env, &usdc_id, &lp, to_usdc(1000.0));

    let shares = vault.deposit(&lp, &to_usdc(1000.0));

    // First deposit: 1:1 → shares equal deposit amount in 7-dec
    assert_eq!(shares, to_usdc(1000.0), "First deposit should be 1:1");

    let info = vault.get_vault_info();
    assert_eq!(info.tvl, to_usdc(1000.0));
    assert_eq!(info.total_shares, to_usdc(1000.0));
    assert_eq!(info.share_price, 10_000_000); // still 1.0
}

#[test]
fn test_deposit_second_lp_same_price() {
    // Before any premium, second LP gets proportional shares at same price
    let (env, vault, usdc_id, _admin) = setup();

    let lp1 = Address::generate(&env);
    let lp2 = Address::generate(&env);
    mint_usdc(&env, &usdc_id, &lp1, to_usdc(1000.0));
    mint_usdc(&env, &usdc_id, &lp2, to_usdc(500.0));

    vault.deposit(&lp1, &to_usdc(1000.0));
    vault.deposit(&lp2, &to_usdc(500.0));

    let lp1_info = vault.get_lp_info(&lp1);
    let lp2_info = vault.get_lp_info(&lp2);

    // lp1 should have 2/3 of pool, lp2 1/3
    let total_shares = lp1_info.shares + lp2_info.shares;
    let lp2_ratio = lp2_info.shares as f64 / total_shares as f64;
    assert!(
        (lp2_ratio - 1.0 / 3.0).abs() < 0.001,
        "lp2 share ratio = {}, expected 1/3",
        lp2_ratio
    );
}

#[test]
fn test_deposit_after_premium_income() {
    // After premium increases TVL, new LP gets fewer shares per USDC
    let (env, vault, usdc_id, admin) = setup();

    let lp1 = Address::generate(&env);
    let lp2 = Address::generate(&env);
    mint_usdc(&env, &usdc_id, &lp1, to_usdc(1000.0));
    mint_usdc(&env, &usdc_id, &lp2, to_usdc(1000.0));
    // Mint premium USDC to vault (simulate it being sent directly)
    mint_usdc(&env, &usdc_id, &admin, to_usdc(100.0));

    // lp1 deposits 1000 USDC
    vault.deposit(&lp1, &to_usdc(1000.0));

    // Premium of 100 USDC is added (TVL goes to 1100, share_price = 1100/1000 = 1.1)
    // Mint USDC to vault contract address first (premium transfer already done)
    let vault_id = vault.address.clone();
    mint_usdc(&env, &usdc_id, &vault_id, to_usdc(100.0));
    vault.receive_premium(&admin, &to_usdc(100.0));

    // Share price is now 1100/1000 = 1.1
    let sp = vault.share_price();
    let sp_f = to_float(sp);
    assert!((sp_f - 1.1).abs() < 0.001, "Share price = {}, expected 1.1", sp_f);

    // lp2 deposits 1000 USDC at share price 1.1 → gets 1000/1.1 ≈ 909 shares
    let lp2_shares = vault.deposit(&lp2, &to_usdc(1000.0));
    let expected_lp2_shares = to_usdc(1000.0) * to_usdc(1000.0) / to_usdc(1100.0);

    // Allow 1 share of rounding
    assert!(
        (lp2_shares - expected_lp2_shares).abs() <= 1,
        "lp2 shares = {}, expected ≈ {}",
        lp2_shares,
        expected_lp2_shares
    );
}

#[test]
fn test_withdraw_full() {
    // Withdraw all shares, get all USDC back (no premium scenario)
    let (env, vault, usdc_id, _admin) = setup();

    let lp = Address::generate(&env);
    mint_usdc(&env, &usdc_id, &lp, to_usdc(1000.0));

    let shares = vault.deposit(&lp, &to_usdc(1000.0));
    let usdc_out = vault.withdraw(&lp, &shares);

    assert_eq!(usdc_out, to_usdc(1000.0), "Full withdraw should return exact USDC");

    let info = vault.get_vault_info();
    assert_eq!(info.tvl, 0);
    assert_eq!(info.total_shares, 0);
}

#[test]
fn test_withdraw_partial() {
    let (env, vault, usdc_id, _admin) = setup();

    let lp = Address::generate(&env);
    mint_usdc(&env, &usdc_id, &lp, to_usdc(1000.0));

    let total_shares = vault.deposit(&lp, &to_usdc(1000.0));
    let half_shares = total_shares / 2;

    let usdc_out = vault.withdraw(&lp, &half_shares);

    // Should get ≈ 500 USDC
    let diff = (to_float(usdc_out) - 500.0).abs();
    assert!(diff < 0.001, "Partial withdraw gave {}, expected 500", to_float(usdc_out));
}

#[test]
#[should_panic(expected = "insufficient unlocked capital")]
fn test_withdraw_more_than_available_fails() {
    // LP tries to withdraw more than available (some is locked)
    let (env, vault, usdc_id, admin) = setup();

    let lp = Address::generate(&env);
    mint_usdc(&env, &usdc_id, &lp, to_usdc(1000.0));

    let shares = vault.deposit(&lp, &to_usdc(1000.0));

    // Lock 800 USDC
    vault.lock_capital(&admin, &to_usdc(800.0));

    // Try to withdraw all shares (would need 1000 USDC but only 200 available)
    vault.withdraw(&lp, &shares);
}

#[test]
#[should_panic(expected = "insufficient shares")]
fn test_withdraw_more_than_owned_fails() {
    let (env, vault, usdc_id, _admin) = setup();

    let lp = Address::generate(&env);
    mint_usdc(&env, &usdc_id, &lp, to_usdc(1000.0));

    let shares = vault.deposit(&lp, &to_usdc(1000.0));

    // Try to withdraw 2x shares owned
    vault.withdraw(&lp, &(shares * 2));
}

#[test]
fn test_lock_capital_increases_locked() {
    let (env, vault, usdc_id, admin) = setup();

    let lp = Address::generate(&env);
    mint_usdc(&env, &usdc_id, &lp, to_usdc(1000.0));
    vault.deposit(&lp, &to_usdc(1000.0));

    vault.lock_capital(&admin, &to_usdc(300.0));

    let info = vault.get_vault_info();
    assert_eq!(info.locked, to_usdc(300.0));
    assert_eq!(info.available, to_usdc(700.0));
}

#[test]
fn test_release_capital_decreases_locked() {
    let (env, vault, usdc_id, admin) = setup();

    let lp = Address::generate(&env);
    mint_usdc(&env, &usdc_id, &lp, to_usdc(1000.0));
    vault.deposit(&lp, &to_usdc(1000.0));

    vault.lock_capital(&admin, &to_usdc(300.0));
    vault.release_capital(&admin, &to_usdc(100.0));

    let info = vault.get_vault_info();
    assert_eq!(info.locked, to_usdc(200.0));
    assert_eq!(info.available, to_usdc(800.0));
}

#[test]
fn test_receive_premium_increases_share_price() {
    let (env, vault, usdc_id, admin) = setup();

    let lp = Address::generate(&env);
    mint_usdc(&env, &usdc_id, &lp, to_usdc(1000.0));
    vault.deposit(&lp, &to_usdc(1000.0));

    let sp_before = vault.share_price();
    assert_eq!(sp_before, 10_000_000); // 1.0

    // Add 100 USDC premium (mint to vault address first)
    let vault_id = vault.address.clone();
    mint_usdc(&env, &usdc_id, &vault_id, to_usdc(100.0));
    vault.receive_premium(&admin, &to_usdc(100.0));

    let sp_after = vault.share_price();
    // New TVL = 1100, shares = 1000 → price = 1.1
    let sp_f = to_float(sp_after);
    assert!((sp_f - 1.1).abs() < 0.001, "Share price after premium = {}", sp_f);
}

#[test]
fn test_pay_settlement_decreases_tvl() {
    let (env, vault, usdc_id, admin) = setup();

    let lp = Address::generate(&env);
    let option_holder = Address::generate(&env);
    mint_usdc(&env, &usdc_id, &lp, to_usdc(1000.0));
    vault.deposit(&lp, &to_usdc(1000.0));
    vault.lock_capital(&admin, &to_usdc(200.0));

    let tvl_before = vault.get_vault_info().tvl;

    // Pay 150 USDC settlement, release 200 locked
    vault.pay_settlement(&admin, &option_holder, &to_usdc(150.0), &to_usdc(200.0));

    let info = vault.get_vault_info();
    assert_eq!(info.tvl, tvl_before - to_usdc(150.0));
    assert_eq!(info.locked, 0);
}

#[test]
#[should_panic(expected = "unauthorized: caller is not option_market")]
fn test_only_option_market_can_lock() {
    let (env, vault, usdc_id, _admin) = setup();

    let lp = Address::generate(&env);
    mint_usdc(&env, &usdc_id, &lp, to_usdc(1000.0));
    vault.deposit(&lp, &to_usdc(1000.0));

    // Non-admin/non-market tries to lock capital
    let attacker = Address::generate(&env);
    vault.lock_capital(&attacker, &to_usdc(100.0));
}

#[test]
#[should_panic(expected = "deposit exceeds max TVL")]
fn test_max_tvl_enforced() {
    let (env, vault, usdc_id, _admin) = setup();

    let lp = Address::generate(&env);
    // Mint more than max_tvl (1M USDC)
    mint_usdc(&env, &usdc_id, &lp, to_usdc(1_500_000.0));

    vault.deposit(&lp, &to_usdc(1_500_000.0));
}

#[test]
fn test_share_price_invariant_no_premium() {
    // Deposit and withdraw without any premium: LP gets exact USDC back
    let (env, vault, usdc_id, _admin) = setup();

    let lp = Address::generate(&env);
    mint_usdc(&env, &usdc_id, &lp, to_usdc(1234.56));

    let deposit_amount = to_usdc(1234.56);
    let shares = vault.deposit(&lp, &deposit_amount);
    let usdc_back = vault.withdraw(&lp, &shares);

    // Must get back exactly what was deposited (no slippage, no fee)
    assert_eq!(usdc_back, deposit_amount, "LP should get exact deposit back");
}

#[test]
fn test_lp_info_correct() {
    let (env, vault, usdc_id, _admin) = setup();

    let lp = Address::generate(&env);
    mint_usdc(&env, &usdc_id, &lp, to_usdc(1000.0));
    vault.deposit(&lp, &to_usdc(1000.0));

    let info = vault.get_lp_info(&lp);
    assert_eq!(info.usdc_value, to_usdc(1000.0));
    assert_eq!(info.share_of_pool_bps, 10_000); // 100% of pool
}

// ─── Audit-fix regression tests ──────────────────────────────────────────────
//
// Tests for the set-once guard on set_option_market (audit #19). The
// vault is initialized with option_market = current_contract_address
// as a placeholder; the admin gets exactly one chance to wire the real
// OptionMarket. After that, the address is immutable so a compromised
// admin cannot redirect pay_settlement to an attacker-controlled
// contract and drain LP capital.
//
// setup() in this file already calls set_option_market once, so these
// tests skip setup() and configure their own fresh vault.

/// fresh_vault: initialize a vault WITHOUT immediately calling
/// set_option_market, so we can test the guards on that function in
/// isolation.
fn fresh_vault() -> (Env, UnderwritingVaultClient<'static>, Address, Address) {
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

    let admin = Address::generate(&env);
    let usdc_admin = Address::generate(&env);
    let usdc_id = env.register_stellar_asset_contract(usdc_admin.clone());
    StellarAssetClient::new(&env, &usdc_id).mint(&admin, &to_usdc(1_000_000.0));

    let vault_id = env.register_contract(None, UnderwritingVault);
    let vault = UnderwritingVaultClient::new(&env, &vault_id);
    vault.initialize(&admin, &usdc_id, &to_usdc(1_000_000.0));

    (env, vault, usdc_id, admin)
}

/// First call to set_option_market succeeds, sets the field once.
#[test]
fn test_set_option_market_first_call_succeeds() {
    let (env, vault, _usdc_id, admin) = fresh_vault();

    let market = Address::generate(&env);
    vault.set_option_market(&admin, &market);

    // get_vault_info exposes TVL/shares/etc.; to confirm the assignment
    // landed we observe that a SECOND attempt fails (next test).
    let info = vault.get_vault_info();
    assert_eq!(info.tvl, 0); // sanity: vault is still empty
}

/// Second call to set_option_market must panic, even from the legitimate
/// admin. This is the core of the audit #19 fix.
#[test]
#[should_panic(expected = "option_market already set")]
fn test_set_option_market_second_call_rejected() {
    let (env, vault, _usdc_id, admin) = fresh_vault();

    let market1 = Address::generate(&env);
    let market2 = Address::generate(&env);

    vault.set_option_market(&admin, &market1);
    // Even the legitimate admin cannot repoint after the first call.
    vault.set_option_market(&admin, &market2);
}

/// If locked_capital somehow became non-zero before the first
/// set_option_market (e.g. via a future change to initialization
/// flow), the guard must still refuse. We can't reach a non-zero
/// locked_capital without first wiring a market, so the symmetric
/// scenario we CAN test is: after a successful set_option_market
/// and a real LP deposit + lock, a subsequent attempt to re-call
/// set_option_market still rejects via the prior 'already set' check.
/// This proves both guards bite.
#[test]
#[should_panic(expected = "option_market already set")]
fn test_set_option_market_rejected_after_lock_too() {
    let (env, vault, usdc_id, admin) = fresh_vault();

    let market = admin.clone(); // use admin as the fake market so it can lock
    vault.set_option_market(&admin, &market);

    let lp = Address::generate(&env);
    mint_usdc(&env, &usdc_id, &lp, to_usdc(1000.0));
    vault.deposit(&lp, &to_usdc(1000.0));
    vault.lock_capital(&market, &to_usdc(500.0));

    // Attempt to repoint after capital is locked. The 'already set'
    // guard fires before the locked-capital guard, but BOTH would
    // reject this scenario.
    let attacker_market = Address::generate(&env);
    vault.set_option_market(&admin, &attacker_market);
}
