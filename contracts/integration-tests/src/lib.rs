/// Integration tests: full end-to-end flows across all three contracts.
///
/// These tests deploy real contract implementations (not mocks) and exercise
/// complete flows: deposit → buy option → settle → claim → withdraw.
#[cfg(test)]
mod tests {
    use option_market::{OptionMarket, OptionMarketClient};
    use option_market::types::OptionType;
    use pricing_engine::{PricingEngine, PricingEngineClient};
    use soroban_sdk::{
        contract, contractimpl, contracttype,
        testutils::{Address as _, Ledger, LedgerInfo},
        token::StellarAssetClient,
        Address, Env, Symbol,
    };
    use underwriting_vault::{UnderwritingVault, UnderwritingVaultClient};

    // ─── Mock Oracle (shared) ─────────────────────────────────────────────────

    #[contract]
    pub struct IntMockOracle;

    #[contracttype]
    enum IntOracleKey {
        Price,
        Ts,
    }

    #[contractimpl]
    impl IntMockOracle {
        pub fn set_price(env: Env, price: i128, ts: u64) {
            env.storage().instance().set(&IntOracleKey::Price, &price);
            env.storage().instance().set(&IntOracleKey::Ts, &ts);
            env.storage().instance().extend_ttl(1_000_000, 10_000_000);
        }

        /// Reflector-compatible interface: price in 14-decimal, used by both
        /// PricingEngine and OptionMarket (both call `lastprice`).
        pub fn lastprice(env: Env, _asset: pricing_engine::oracle::Asset) -> Option<pricing_engine::oracle::PriceData> {
            env.storage().instance().extend_ttl(1_000_000, 10_000_000);
            let price: i128 = env.storage().instance().get(&IntOracleKey::Price).unwrap_or(0);
            let timestamp: u64 = env.storage().instance().get(&IntOracleKey::Ts).unwrap_or(0);
            Some(pricing_engine::oracle::PriceData { price, timestamp })
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    const SCALE: i128 = 10_000_000;
    const BASE_TIME: u64 = 1_700_000_000;
    const CONTRACT_SIZE: u64 = 10_000_000; // 1 XLM

    fn to_usdc(f: f64) -> i128 {
        (f * SCALE as f64).round() as i128
    }

    fn to_float(x: i128) -> f64 {
        x as f64 / SCALE as f64
    }

    fn expiry_7d() -> u64 {
        BASE_TIME + 7 * 86_400
    }

    fn advance_past_expiry(env: &Env) {
        env.ledger().set(LedgerInfo {
            timestamp: expiry_7d() + 100,
            protocol_version: 21,
            sequence_number: 500,
            network_id: Default::default(),
            base_reserve: 5_000_000,
            min_temp_entry_ttl: 1,
            min_persistent_entry_ttl: 1,
            max_entry_ttl: 100_000_000,
        });
    }

    struct TestWorld {
        env: Env,
        admin: Address,
        pricing: PricingEngineClient<'static>,
        vault: UnderwritingVaultClient<'static>,
        market: OptionMarketClient<'static>,
        oracle_id: Address,
        usdc_id: Address,
    }

    fn deploy_all() -> TestWorld {
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
            max_entry_ttl: 100_000_000,
        });

        let admin = Address::generate(&env);
        let usdc_admin = Address::generate(&env);
        let usdc_id = env.register_stellar_asset_contract(usdc_admin.clone());
        let usdc_sac = StellarAssetClient::new(&env, &usdc_id);

        // Oracle: 0.12 USD per XLM (Reflector 14-decimal: 0.12 * 10^14 = 12_000_000_000_000)
        let oracle_id = env.register_contract(None, IntMockOracle);
        IntMockOracleClient::new(&env, &oracle_id)
            .set_price(&12_000_000_000_000i128, &BASE_TIME);

        // PricingEngine
        let pe_id = env.register_contract(None, PricingEngine);
        let pricing = PricingEngineClient::new(&env, &pe_id);
        pricing.initialize(
            &admin,
            &oracle_id,
            &8000u64, // 80% IV
            &100u64,  // 1% spread
        );

        // Vault
        let vault_id = env.register_contract(None, UnderwritingVault);
        let vault = UnderwritingVaultClient::new(&env, &vault_id);
        vault.initialize(&admin, &usdc_id, &to_usdc(1_000_000.0));

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

        // Wire vault → market
        vault.set_option_market(&admin, &market_id);

        // Seed vault: admin deposits 10,000 USDC
        usdc_sac.mint(&admin, &to_usdc(500_000.0));
        vault.deposit(&admin, &to_usdc(10_000.0));

        // Create epoch
        market.create_epoch(&admin, &expiry_7d());

        TestWorld {
            env,
            admin,
            pricing,
            vault,
            market,
            oracle_id,
            usdc_id,
        }
    }

    fn mint_usdc(env: &Env, usdc_id: &Address, to: &Address, amount: i128) {
        StellarAssetClient::new(env, usdc_id).mint(to, &amount);
    }

    // ─── Integration Tests ────────────────────────────────────────────────────

    /// Full flow: deposit → buy ITM call → advance time → settle → claim.
    #[test]
    fn test_full_flow_call_itm() {
        let w = deploy_all();

        let lp = Address::generate(&w.env);
        let trader = Address::generate(&w.env);
        mint_usdc(&w.env, &w.usdc_id, &lp, to_usdc(5_000.0));
        mint_usdc(&w.env, &w.usdc_id, &trader, to_usdc(1_000.0));

        // LP deposits
        w.vault.deposit(&lp, &to_usdc(5_000.0));

        let vault_tvl_before = w.vault.get_vault_info().tvl;

        // Trader buys ATM call (strike = 0.12)
        let strike = to_usdc(0.12);
        let pos_id = w.market.buy_call(&trader, &strike, &expiry_7d(), &10u64);

        let pos = w.market.get_position(&pos_id);
        assert!(pos.premium_paid > 0);
        assert!(pos.locked_amount > 0);

        // Vault TVL increased by premium
        let vault_tvl_after_buy = w.vault.get_vault_info().tvl;
        assert!(vault_tvl_after_buy > vault_tvl_before);

        // Advance past expiry, set ITM settlement price (0.15)
        advance_past_expiry(&w.env);
        IntMockOracleClient::new(&w.env, &w.oracle_id)
            .set_price(&15_000_000_000_000i128, &(expiry_7d() + 100));

        // Settle
        w.market.settle(&w.admin, &expiry_7d());

        let settled_pos = w.market.get_position(&pos_id);
        assert!(settled_pos.settled);
        // ITM: payout = (0.15 - 0.12) * 10 XLM = 0.30 USDC
        assert!(
            (to_float(settled_pos.payout) - 0.30).abs() < 0.01,
            "ITM call payout = {}",
            to_float(settled_pos.payout)
        );

        // Claim
        w.market.claim(&trader, &pos_id);
        let final_pos = w.market.get_position(&pos_id);
        assert!(final_pos.claimed);
    }

    /// Full flow: buy OTM put → expire worthless → vault premium stays.
    #[test]
    fn test_full_flow_put_otm() {
        let w = deploy_all();

        let lp = Address::generate(&w.env);
        mint_usdc(&w.env, &w.usdc_id, &lp, to_usdc(5_000.0));
        w.vault.deposit(&lp, &to_usdc(5_000.0));

        let sp_before = w.vault.share_price();

        let trader = Address::generate(&w.env);
        mint_usdc(&w.env, &w.usdc_id, &trader, to_usdc(500.0));

        // Buy OTM put (strike below spot — 5% below ATM)
        let spot = to_usdc(0.12);
        let strike_otm = spot - spot * 500 / 10_000; // -5%
        let pos_id = w.market.buy_put(&trader, &strike_otm, &expiry_7d(), &5u64);

        advance_past_expiry(&w.env);
        // Settlement price above strike → OTM
        IntMockOracleClient::new(&w.env, &w.oracle_id)
            .set_price(&12_000_000_000_000i128, &(expiry_7d() + 100));

        w.market.settle(&w.admin, &expiry_7d());

        let pos = w.market.get_position(&pos_id);
        assert_eq!(pos.payout, 0, "OTM put should expire worthless");
        assert!(pos.claimed, "OTM should be auto-claimed");

        // Share price should have increased (premium kept by vault)
        let sp_after = w.vault.share_price();
        assert!(sp_after > sp_before, "Share price should increase from premium");
    }

    /// Multiple LPs split premiums proportionally.
    #[test]
    fn test_multiple_lps_share_split() {
        let w = deploy_all();

        let lp1 = Address::generate(&w.env);
        let lp2 = Address::generate(&w.env);
        mint_usdc(&w.env, &w.usdc_id, &lp1, to_usdc(6_000.0));
        mint_usdc(&w.env, &w.usdc_id, &lp2, to_usdc(4_000.0));

        w.vault.deposit(&lp1, &to_usdc(6_000.0));
        w.vault.deposit(&lp2, &to_usdc(4_000.0));

        let lp1_shares = w.vault.get_lp_info(&lp1).shares;
        let lp2_shares = w.vault.get_lp_info(&lp2).shares;

        // Trader buys to generate premium
        let trader = Address::generate(&w.env);
        mint_usdc(&w.env, &w.usdc_id, &trader, to_usdc(1_000.0));
        w.market.buy_call(&trader, &to_usdc(0.12), &expiry_7d(), &10u64);

        // Settle OTM (vault keeps premium)
        advance_past_expiry(&w.env);
        IntMockOracleClient::new(&w.env, &w.oracle_id)
            .set_price(&10_000_000_000_000i128, &(expiry_7d() + 100));
        w.market.settle(&w.admin, &expiry_7d());

        // Both LPs share price increased proportionally
        let lp1_val = w.vault.get_lp_info(&lp1).usdc_value;
        let lp2_val = w.vault.get_lp_info(&lp2).usdc_value;

        // lp1 has 60% of pool, lp2 has 40%
        assert!(lp1_val > to_usdc(6_000.0), "LP1 should earn premium");
        assert!(lp2_val > to_usdc(4_000.0), "LP2 should earn premium");

        // Ratio should be approximately 3:2 (60:40)
        let ratio = lp1_val as f64 / lp2_val as f64;
        assert!(
            (ratio - 1.5).abs() < 0.01,
            "LP1/LP2 ratio = {}, expected 1.5",
            ratio
        );
    }

    /// Vault capacity limit: buying beyond available capital fails.
    #[test]
    #[should_panic(expected = "insufficient vault capacity")]
    fn test_vault_capacity_limit() {
        let w = deploy_all();

        // Vault has 10,000 USDC. Buy massive amount that exceeds capacity.
        let trader = Address::generate(&w.env);
        mint_usdc(&w.env, &w.usdc_id, &trader, to_usdc(100_000.0));

        // 100,000 contracts at 0.12 strike → locked = 100,000 * 1 * 0.12 = 12,000 USDC
        // But vault only has 10,000
        w.market.buy_call(&trader, &to_usdc(0.12), &expiry_7d(), &100_000u64);
    }

    /// LP cannot withdraw more than available (unlocked) capital.
    #[test]
    #[should_panic(expected = "insufficient unlocked capital")]
    fn test_lp_withdraw_during_active_options() {
        let w = deploy_all();

        let lp = Address::generate(&w.env);
        mint_usdc(&w.env, &w.usdc_id, &lp, to_usdc(5_000.0));
        w.vault.deposit(&lp, &to_usdc(5_000.0));

        // Buy option that locks most of vault capital.
        // Vault total: 10,000 (admin) + 5,000 (lp) = 15,000 USDC.
        // 120,000 contracts * 1 XLM * 0.12 strike = 14,400 USDC locked → only 600 available.
        let trader = Address::generate(&w.env);
        mint_usdc(&w.env, &w.usdc_id, &trader, to_usdc(5_000.0));
        w.market.buy_call(&trader, &to_usdc(0.12), &expiry_7d(), &120_000u64);

        // Try to withdraw full LP amount (only ~200 USDC unlocked)
        let lp_shares = w.vault.get_lp_info(&lp).shares;
        w.vault.withdraw(&lp, &lp_shares); // should fail
    }

    /// Multiple positions (mixed ITM/OTM) settle correctly.
    #[test]
    fn test_multiple_positions_mixed_outcomes() {
        let w = deploy_all();

        let trader1 = Address::generate(&w.env);
        let trader2 = Address::generate(&w.env);
        let trader3 = Address::generate(&w.env);
        let trader4 = Address::generate(&w.env);

        for t in [&trader1, &trader2, &trader3, &trader4] {
            mint_usdc(&w.env, &w.usdc_id, t, to_usdc(2_000.0));
        }

        // 2 calls, 2 puts at different strikes
        let strike_atm = to_usdc(0.12);
        let spot = to_usdc(0.12);
        let strike_otm_put = spot - spot * 500 / 10_000; // -5% OTM put

        let id_c1 = w.market.buy_call(&trader1, &strike_atm, &expiry_7d(), &5u64); // will be ITM
        let id_c2 = w.market.buy_call(&trader2, &strike_atm, &expiry_7d(), &5u64); // will be ITM
        let id_p1 = w.market.buy_put(&trader3, &strike_atm, &expiry_7d(), &5u64); // will be OTM
        let id_p2 = w.market.buy_put(&trader4, &strike_otm_put, &expiry_7d(), &5u64); // OTM

        advance_past_expiry(&w.env);

        // Settlement at 0.15 → calls ITM, puts OTM
        IntMockOracleClient::new(&w.env, &w.oracle_id)
            .set_price(&15_000_000_000_000i128, &(expiry_7d() + 100));

        w.market.settle(&w.admin, &expiry_7d());

        let pos_c1 = w.market.get_position(&id_c1);
        let pos_c2 = w.market.get_position(&id_c2);
        let pos_p1 = w.market.get_position(&id_p1);
        let pos_p2 = w.market.get_position(&id_p2);

        // Both calls ITM: (0.15 - 0.12) * 5 = 0.15 USDC each
        assert!(pos_c1.payout > 0, "Call 1 should be ITM");
        assert!(pos_c2.payout > 0, "Call 2 should be ITM");
        assert_eq!(pos_c1.payout, pos_c2.payout, "Equal calls should have equal payouts");

        // Both puts OTM
        assert_eq!(pos_p1.payout, 0, "Put 1 should expire OTM");
        assert_eq!(pos_p2.payout, 0, "Put 2 should expire OTM");

        // Claims for ITM calls work
        w.market.claim(&trader1, &id_c1);
        w.market.claim(&trader2, &id_c2);

        assert!(w.market.get_position(&id_c1).claimed);
        assert!(w.market.get_position(&id_c2).claimed);
    }

    /// Pause blocks all purchases.
    #[test]
    #[should_panic(expected = "market paused")]
    fn test_pause_blocks_buying() {
        let w = deploy_all();
        w.market.set_paused(&w.admin, &true);

        let trader = Address::generate(&w.env);
        mint_usdc(&w.env, &w.usdc_id, &trader, to_usdc(1_000.0));
        w.market.buy_call(&trader, &to_usdc(0.12), &expiry_7d(), &1u64);
    }

    /// Share price correctly reflects P&L after settlement.
    #[test]
    fn test_share_price_reflects_pnl() {
        let w = deploy_all();

        let lp = Address::generate(&w.env);
        mint_usdc(&w.env, &w.usdc_id, &lp, to_usdc(5_000.0));
        w.vault.deposit(&lp, &to_usdc(5_000.0));

        let sp_initial = w.vault.share_price();

        // Buy OTM call (vault collects premium, never pays out)
        let trader = Address::generate(&w.env);
        mint_usdc(&w.env, &w.usdc_id, &trader, to_usdc(500.0));
        w.market.buy_call(&trader, &to_usdc(0.12), &expiry_7d(), &50u64);

        advance_past_expiry(&w.env);
        // OTM settlement (price stays at 0.12, call with strike 0.12 is ATM/OTM)
        // Actually ATM at expiry → payout = max(0, 0.12-0.12) = 0, so OTM
        IntMockOracleClient::new(&w.env, &w.oracle_id)
            .set_price(&12_000_000_000_000i128, &(expiry_7d() + 100));
        w.market.settle(&w.admin, &expiry_7d());

        let sp_final = w.vault.share_price();
        // Premium was collected → share price increased
        assert!(
            sp_final > sp_initial,
            "Share price {} should > initial {} after keeping premium",
            to_float(sp_final),
            to_float(sp_initial)
        );
    }
}
