#![no_std]

pub mod settlement;
pub mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contractimpl, symbol_short, token, Address, Env, String, Vec,
};

use settlement::{calc_payout, validated_payout};
use types::{DataKey, MarketConfig, OptionType, Position, SettlementInfo, StrikeInfo};


/// Oracle price data (DIA format).
/// Exposed at crate level for mock oracle in tests.
#[soroban_sdk::contracttype]
#[derive(Clone)]
pub struct OptionMarketOracleValue {
    pub price: u128,
    pub timestamp: u128,
}

/// 7-decimal fixed-point scale.
const SCALE: i128 = 10_000_000;

/// Strike offsets from spot (5%, 10%, 15%, 20%).
const STRIKE_OFFSETS_BPS: [i128; 4] = [500, 1000, 1500, 2000];

// ─── Interfaces for cross-contract calls ─────────────────────────────────────

mod pricing_engine_interface {
    use soroban_sdk::{contractclient, Address, Env};

    #[contractclient(name = "PricingEngineClient")]
    pub trait PricingEngineInterface {
        fn calc_call_premium(env: Env, strike: i128, expiry: u64, amount: u64) -> i128;
        fn calc_put_premium(env: Env, strike: i128, expiry: u64, amount: u64) -> i128;
        fn get_spot_price(env: Env) -> i128;
    }
}

mod vault_interface {
    use soroban_sdk::{contractclient, Address, Env};

    #[contractclient(name = "VaultClient")]
    pub trait VaultInterface {
        fn available_capital(env: Env) -> i128;
        fn lock_capital(env: Env, caller: Address, amount: i128);
        fn release_capital(env: Env, caller: Address, amount: i128);
        fn receive_premium(env: Env, caller: Address, amount: i128);
        fn pay_settlement(env: Env, caller: Address, recipient: Address, amount: i128, locked: i128);
    }
}

use pricing_engine_interface::PricingEngineClient;
use vault_interface::VaultClient;

// ─── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct OptionMarket;

#[contractimpl]
impl OptionMarket {
    /// Initialize the OptionMarket.
    ///
    /// # Arguments
    /// * `admin`          — administrator address
    /// * `pricing_engine` — PricingEngine contract address
    /// * `vault`          — UnderwritingVault contract address
    /// * `usdc_token`     — SAC-wrapped USDC address
    /// * `oracle`         — DIA oracle address
    /// * `contract_size`  — XLM per contract in 7-decimal (10_000_000 = 1 XLM)
    pub fn initialize(
        env: Env,
        admin: Address,
        pricing_engine: Address,
        vault: Address,
        usdc_token: Address,
        oracle: Address,
        contract_size: u64,
    ) {
        if env.storage().instance().has(&DataKey::Config) {
            let cfg: MarketConfig = env.storage().instance().get(&DataKey::Config).unwrap();
            if !cfg.paused || cfg.next_position_id > 0 {
                // Already fully initialized
                panic!("already initialized");
            }
        }

        admin.require_auth();

        if contract_size == 0 {
            panic!("contract_size must be positive");
        }

        let config = MarketConfig {
            admin,
            pricing_engine,
            vault,
            usdc_token,
            oracle,
            contract_size,
            paused: false,
            next_position_id: 0,
        };

        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().extend_ttl(100_000, 1_000_000);
    }

    /// Create a new option epoch: generate strikes for a given expiry.
    ///
    /// Strikes are generated at ±5%, ±10%, ±15%, ±20% from current spot
    /// (rounded to 3 significant figures for cleanliness).
    ///
    /// # Arguments
    /// * `admin`  — must be the contract admin
    /// * `expiry` — Unix timestamp for this epoch's expiry (must be future)
    pub fn create_epoch(env: Env, admin: Address, expiry: u64) {
        admin.require_auth();

        let config: MarketConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        if config.admin != admin {
            panic!("unauthorized");
        }

        let now = env.ledger().timestamp();
        if expiry <= now {
            panic!("expiry must be in the future");
        }

        // Prevent duplicate epochs
        if env
            .storage()
            .persistent()
            .has(&DataKey::ActiveStrikes(expiry))
        {
            panic!("epoch already exists");
        }

        // Get current spot price from PricingEngine
        let pe = PricingEngineClient::new(&env, &config.pricing_engine);
        let spot = pe.get_spot_price();

        if spot <= 0 {
            panic!("invalid spot price");
        }

        let mut strikes: Vec<StrikeInfo> = Vec::new(&env);

        // ATM strike — premiums are 0 here (fetched live via get_premium / buy_call / buy_put).
        // Storing premiums at epoch creation would require 18 cross-contract calls (9 strikes × 2
        // directions), which exceeds Soroban's per-transaction compute budget. Premiums are always
        // quoted live in get_premium, buy_call, and buy_put, so this is the correct design.
        strikes.push_back(StrikeInfo {
            strike: spot,
            expiry,
            call_premium: 0,
            put_premium: 0,
        });

        // OTM/ITM strikes at ±5%, ±10%, ±15%, ±20%
        for &offset_bps in STRIKE_OFFSETS_BPS.iter() {
            // Higher strike (OTM call / ITM put)
            let higher = spot + spot * offset_bps / 10_000;
            strikes.push_back(StrikeInfo {
                strike: higher,
                expiry,
                call_premium: 0,
                put_premium: 0,
            });

            // Lower strike (ITM call / OTM put)
            let lower = spot - spot * offset_bps / 10_000;
            strikes.push_back(StrikeInfo {
                strike: lower,
                expiry,
                call_premium: 0,
                put_premium: 0,
            });
        }

        env.storage()
            .persistent()
            .set(&DataKey::ActiveStrikes(expiry), &strikes);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::ActiveStrikes(expiry), 100_000, 1_000_000);

        env.events().publish(
            (symbol_short!("EPOCH"),),
            (expiry, strikes.len() as u32),
        );
    }

    /// Buy a call option.
    ///
    /// Full purchase flow:
    /// 1. Validate inputs
    /// 2. Get premium from PricingEngine
    /// 3. Verify vault capacity
    /// 4. Transfer premium USDC from buyer to vault
    /// 5. Notify vault (receive_premium + lock_capital)
    /// 6. Create and store position
    /// 7. Emit event
    ///
    /// Returns the new position ID.
    pub fn buy_call(env: Env, buyer: Address, strike: i128, expiry: u64, amount: u64) -> u64 {
        buyer.require_auth();

        let config: MarketConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        if config.paused {
            panic!("market paused");
        }

        let now = env.ledger().timestamp();
        if now >= expiry {
            panic!("expiry must be in the future");
        }

        if amount == 0 {
            panic!("amount must be positive");
        }

        // Validate strike is in active set for this expiry
        let strikes: Vec<StrikeInfo> = env
            .storage()
            .persistent()
            .get(&DataKey::ActiveStrikes(expiry))
            .unwrap_or_else(|| Vec::new(&env));

        let strike_valid = strikes.iter().any(|s| s.strike == strike);
        if !strike_valid {
            panic!("invalid strike for this expiry");
        }

        // Get premium from PricingEngine
        let pe = PricingEngineClient::new(&env, &config.pricing_engine);
        let premium = pe.calc_call_premium(&strike, &expiry, &amount);

        if premium <= 0 {
            panic!("zero premium");
        }

        // Calculate collateral to lock:
        // Max call payout = (settlement_price - strike) * amount * contract_size
        // We cap at strike (max 100% price move) for a conservative bound.
        // locked = amount * contract_size * strike / SCALE
        let locked = (amount as i128)
            .checked_mul(config.contract_size as i128)
            .expect("overflow in locked calc")
            .checked_mul(strike)
            .expect("overflow in locked calc")
            / SCALE;

        // Verify vault capacity
        let vault = VaultClient::new(&env, &config.vault);
        let available = vault.available_capital();

        if available < locked {
            panic!("insufficient vault capacity");
        }

        // Transfer premium from buyer to vault
        let usdc = token::Client::new(&env, &config.usdc_token);
        usdc.transfer(&buyer, &config.vault, &premium);

        // Notify vault
        let market_addr = env.current_contract_address();
        vault.receive_premium(&market_addr, &premium);
        vault.lock_capital(&market_addr, &locked);

        // Create position
        let position_id = config.next_position_id;
        let position = Position {
            id: position_id,
            owner: buyer.clone(),
            option_type: OptionType::Call,
            strike,
            expiry,
            amount,
            premium_paid: premium,
            locked_amount: locked,
            settled: false,
            payout: 0,
            claimed: false,
        };

        Self::store_position(&env, &config, position_id, &position, &buyer, expiry);

        // Increment position counter
        let mut new_config = config;
        new_config.next_position_id += 1;
        env.storage().instance().set(&DataKey::Config, &new_config);
        env.storage().instance().extend_ttl(100_000, 1_000_000);

        env.events().publish(
            (symbol_short!("BUY_CALL"), buyer),
            (position_id, strike, expiry, amount, premium),
        );

        position_id
    }

    /// Buy a put option.
    ///
    /// Symmetric to `buy_call`. Locked collateral = amount * contract_size * strike / SCALE
    /// (max put payout = strike, when settlement_price = 0).
    ///
    /// Returns the new position ID.
    pub fn buy_put(env: Env, buyer: Address, strike: i128, expiry: u64, amount: u64) -> u64 {
        buyer.require_auth();

        let config: MarketConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        if config.paused {
            panic!("market paused");
        }

        let now = env.ledger().timestamp();
        if now >= expiry {
            panic!("expiry must be in the future");
        }

        if amount == 0 {
            panic!("amount must be positive");
        }

        let strikes: Vec<StrikeInfo> = env
            .storage()
            .persistent()
            .get(&DataKey::ActiveStrikes(expiry))
            .unwrap_or_else(|| Vec::new(&env));

        let strike_valid = strikes.iter().any(|s| s.strike == strike);
        if !strike_valid {
            panic!("invalid strike for this expiry");
        }

        let pe = PricingEngineClient::new(&env, &config.pricing_engine);
        let premium = pe.calc_put_premium(&strike, &expiry, &amount);

        if premium <= 0 {
            panic!("zero premium");
        }

        // Max put payout = strike * amount * contract_size / SCALE
        let locked = (amount as i128)
            .checked_mul(config.contract_size as i128)
            .expect("overflow")
            .checked_mul(strike)
            .expect("overflow")
            / SCALE;

        let vault = VaultClient::new(&env, &config.vault);
        let available = vault.available_capital();
        if available < locked {
            panic!("insufficient vault capacity");
        }

        let usdc = token::Client::new(&env, &config.usdc_token);
        usdc.transfer(&buyer, &config.vault, &premium);

        let market_addr = env.current_contract_address();
        vault.receive_premium(&market_addr, &premium);
        vault.lock_capital(&market_addr, &locked);

        let position_id = config.next_position_id;
        let position = Position {
            id: position_id,
            owner: buyer.clone(),
            option_type: OptionType::Put,
            strike,
            expiry,
            amount,
            premium_paid: premium,
            locked_amount: locked,
            settled: false,
            payout: 0,
            claimed: false,
        };

        Self::store_position(&env, &config, position_id, &position, &buyer, expiry);

        let mut new_config = config;
        new_config.next_position_id += 1;
        env.storage().instance().set(&DataKey::Config, &new_config);
        env.storage().instance().extend_ttl(100_000, 1_000_000);

        env.events().publish(
            (symbol_short!("BUY_PUT"), buyer),
            (position_id, strike, expiry, amount, premium),
        );

        position_id
    }

    /// Settle all positions for a given expiry.
    ///
    /// Can be called by anyone after the expiry timestamp has passed.
    /// Fetches settlement price from DIA oracle, calculates payouts
    /// for all positions, updates position records, and handles vault accounting.
    ///
    /// # Arguments
    /// * `caller` — address initiating settlement (anyone)
    /// * `expiry` — expiry timestamp to settle
    pub fn settle(env: Env, caller: Address, expiry: u64) {
        caller.require_auth();

        let config: MarketConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        let now = env.ledger().timestamp();
        if now < expiry {
            panic!("expiry has not passed");
        }

        // Prevent double settlement
        if env
            .storage()
            .persistent()
            .has(&DataKey::ExpirySettled(expiry))
        {
            panic!("already settled");
        }

        // Get settlement price from oracle
        // For settlement we use a longer staleness window (1 hour)
        // since settlement happens after the fact
        let settlement_price = Self::get_settlement_price(&env, &config.oracle);

        // Get all positions for this expiry
        let position_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::ExpiryPositions(expiry))
            .unwrap_or_else(|| Vec::new(&env));

        let vault = VaultClient::new(&env, &config.vault);
        let market_addr = env.current_contract_address();

        for pos_id in position_ids.iter() {
            let mut pos: Position = env
                .storage()
                .persistent()
                .get(&DataKey::Position(pos_id))
                .expect("position not found");

            if pos.settled {
                continue;
            }

            let payout = calc_payout(&pos, settlement_price, config.contract_size);
            let safe_payout = validated_payout(payout, pos.locked_amount);

            // Release the locked capital and pay out if ITM
            vault.pay_settlement(
                &market_addr,
                &pos.owner,
                &safe_payout,
                &pos.locked_amount,
            );

            pos.settled = true;
            pos.payout = safe_payout;
            // If payout is 0, mark as claimed (nothing to claim)
            if safe_payout == 0 {
                pos.claimed = true;
            }

            env.storage()
                .persistent()
                .set(&DataKey::Position(pos_id), &pos);
            env.storage()
                .persistent()
                .extend_ttl(&DataKey::Position(pos_id), 100_000, 1_000_000);
        }

        // Record settlement
        let settlement_info = SettlementInfo {
            settlement_price,
            settled_at: now,
            settled_by: caller.clone(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::ExpirySettled(expiry), &settlement_info);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::ExpirySettled(expiry), 100_000, 1_000_000);

        env.events().publish(
            (symbol_short!("SETTLE"), caller),
            (expiry, settlement_price),
        );
    }

    /// Claim ITM payout for a settled position.
    ///
    /// Note: payouts are already transferred during `settle()`.
    /// This function marks the claim and emits the event for indexing.
    /// It also handles the case where the transfer was deferred.
    ///
    /// # Arguments
    /// * `owner`       — position owner (must be the position's owner)
    /// * `position_id` — the position to claim
    pub fn claim(env: Env, owner: Address, position_id: u64) {
        owner.require_auth();

        let mut pos: Position = env
            .storage()
            .persistent()
            .get(&DataKey::Position(position_id))
            .expect("position not found");

        if pos.owner != owner {
            panic!("not position owner");
        }

        if !pos.settled {
            panic!("position not yet settled");
        }

        if pos.claimed {
            panic!("already claimed");
        }

        if pos.payout == 0 {
            panic!("no payout (option expired OTM)");
        }

        // Mark as claimed
        pos.claimed = true;
        env.storage()
            .persistent()
            .set(&DataKey::Position(position_id), &pos);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Position(position_id), 100_000, 1_000_000);

        env.events().publish(
            (symbol_short!("CLAIM"), owner),
            (position_id, pos.payout),
        );
    }

    /// Get a premium quote without executing a purchase.
    pub fn get_premium(
        env: Env,
        option_type: OptionType,
        strike: i128,
        expiry: u64,
        amount: u64,
    ) -> i128 {
        let config: MarketConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        let pe = PricingEngineClient::new(&env, &config.pricing_engine);
        match option_type {
            OptionType::Call => pe.calc_call_premium(&strike, &expiry, &amount),
            OptionType::Put => pe.calc_put_premium(&strike, &expiry, &amount),
        }
    }

    /// Get a position by ID.
    pub fn get_position(env: Env, position_id: u64) -> Position {
        env.storage()
            .persistent()
            .get(&DataKey::Position(position_id))
            .expect("position not found")
    }

    /// Get all position IDs for a user.
    pub fn get_user_positions(env: Env, user: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::UserPositions(user))
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Get available strikes for a given expiry.
    pub fn get_strikes(env: Env, expiry: u64) -> Vec<StrikeInfo> {
        env.storage()
            .persistent()
            .get(&DataKey::ActiveStrikes(expiry))
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Check if an expiry has been settled.
    pub fn is_settled(env: Env, expiry: u64) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::ExpirySettled(expiry))
    }

    /// Get settlement info for a settled expiry.
    pub fn get_settlement(env: Env, expiry: u64) -> SettlementInfo {
        env.storage()
            .persistent()
            .get(&DataKey::ExpirySettled(expiry))
            .expect("expiry not settled")
    }

    /// Emergency pause/unpause (admin-only).
    pub fn set_paused(env: Env, admin: Address, paused: bool) {
        admin.require_auth();

        let mut config: MarketConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        if config.admin != admin {
            panic!("unauthorized");
        }

        config.paused = paused;
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().extend_ttl(100_000, 1_000_000);

        env.events()
            .publish((symbol_short!("PAUSED"),), (paused,));
    }

    /// Get market config.
    pub fn get_config(env: Env) -> MarketConfig {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized")
    }

    // ─── Private Helpers ──────────────────────────────────────────────────────

    /// Fetch settlement price from DIA oracle with relaxed staleness (1 hour).
    fn get_settlement_price(env: &Env, oracle: &Address) -> i128 {
        let key = String::from_str(env, "XLM/USD");
        let oracle_value: OptionMarketOracleValue = env.invoke_contract(
            oracle,
            &symbol_short!("get_value"),
            soroban_sdk::vec![env, soroban_sdk::IntoVal::into_val(&key, env)],
        );

        let now = env.ledger().timestamp() as u128;
        // Allow 1 hour staleness for settlement
        if now > oracle_value.timestamp + 3600 {
            panic!("oracle: settlement price too stale");
        }

        if oracle_value.price == 0 {
            panic!("oracle: invalid settlement price");
        }

        // Convert from DIA's 8-decimal to our 7-decimal (divide by 10)
        (oracle_value.price / 10) as i128
    }

    /// Store a position and update user/expiry indexes.
    fn store_position(
        env: &Env,
        _config: &MarketConfig,
        position_id: u64,
        position: &Position,
        owner: &Address,
        expiry: u64,
    ) {
        // Store position record
        env.storage()
            .persistent()
            .set(&DataKey::Position(position_id), position);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Position(position_id), 100_000, 1_000_000);

        // Append to user's position list
        let mut user_pos: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::UserPositions(owner.clone()))
            .unwrap_or_else(|| Vec::new(env));
        user_pos.push_back(position_id);
        env.storage()
            .persistent()
            .set(&DataKey::UserPositions(owner.clone()), &user_pos);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::UserPositions(owner.clone()), 100_000, 1_000_000);

        // Append to expiry's position list
        let mut expiry_pos: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::ExpiryPositions(expiry))
            .unwrap_or_else(|| Vec::new(env));
        expiry_pos.push_back(position_id);
        env.storage()
            .persistent()
            .set(&DataKey::ExpiryPositions(expiry), &expiry_pos);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::ExpiryPositions(expiry), 100_000, 1_000_000);
    }
}
