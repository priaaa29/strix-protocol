#![no_std]

pub mod settlement;
pub mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contractimpl, symbol_short, token, Address, Env, Symbol, Vec,
};

use settlement::{calc_payout, capped_payout};
use types::{DataKey, MarketConfig, OptionType, Position, SettlementInfo, StrikeInfo};


/// Asset variant matching Reflector oracle interface.
/// Exposed at crate level for mock oracle in tests.
#[soroban_sdk::contracttype]
#[derive(Clone)]
pub enum OptionMarketAsset {
    Stellar(Address),
    Other(Symbol),
}

/// Price data returned by Reflector oracle.
/// Exposed at crate level for mock oracle in tests.
#[soroban_sdk::contracttype]
#[derive(Clone)]
pub struct OptionMarketPriceData {
    pub price: i128,
    pub timestamp: u64,
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
    /// * `oracle`         — Reflector oracle address
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
        // Strict init guard: any prior config means we're done. The previous
        // check (`if !cfg.paused || cfg.next_position_id > 0`) allowed
        // initialize() to be re-run while the market was paused before its
        // first buy, which would let an attacker (or accidental rerun)
        // overwrite admin/pricing_engine/vault/oracle wiring.
        if env.storage().instance().has(&DataKey::Config) {
            panic!("already initialized");
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

        // Collateral lock for calls.
        //
        // The locked amount equals `amount * contract_size * strike`,
        // which is the call's intrinsic value at settlement_price = 2 × strike.
        // Holders are GUARANTEED the full intrinsic up to that point; above
        // 2 × strike the payout is CAPPED at the locked amount and the
        // settle() flow emits a PAYCAP event so the cap is visible on-chain.
        //
        // This trade-off lets the protocol size its vault liquidity needs at
        // 1× notional per call (rather than unbounded, which would require
        // infinite TVL). The cap is disclosed in the buy UI's premium card.
        // For OTM calls (strike > spot) the cap fires only on price moves
        // beyond +100% of strike, which is rarely hit on weekly expiries.
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
    /// Fetches settlement price from the Reflector oracle, calculates payouts
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

        // Get settlement price from oracle. Pass expiry so the helper can
        // enforce 'price published near the expiry' rather than 'price
        // is fresh now' — closes the audit window where a late settler
        // could anchor to a much-later price.
        let settlement_price = Self::get_settlement_price(&env, &config.oracle, expiry);

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
            let (safe_payout, was_capped) = capped_payout(payout, pos.locked_amount);

            // Surface the cap on-chain so holders can verify why their
            // payout is less than the naive (settlement_price - strike) ×
            // amount formula. The cap is intentional (see buy_call doc)
            // but should never be silent.
            if was_capped {
                env.events().publish(
                    (symbol_short!("PAYCAP"),),
                    (pos_id, payout, safe_payout),
                );
            }

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

    /// Fetch the settlement price from the Reflector oracle.
    ///
    /// Settlement-time fairness: the audit flagged that the previous
    /// implementation accepted any oracle price with a 1-hour staleness
    /// window, which let a caller wait for a favourable moment and choose
    /// when to settle (effectively re-rolling the strike). To fix this:
    ///   1. The oracle price's own timestamp must be no older than 15 min
    ///      (matches Reflector's testnet ~5 min update cadence with margin).
    ///   2. The price's timestamp must be no more than 30 min AFTER expiry
    ///      — i.e. the price had to be "near expiry" at the time it was
    ///      published. A caller settling days late can no longer pick a
    ///      drifted price.
    /// Both checks panic with a specific message so failures are debuggable.
    fn get_settlement_price(env: &Env, oracle: &Address, expiry: u64) -> i128 {
        let asset = OptionMarketAsset::Other(Symbol::new(env, "XLM"));
        let result: Option<OptionMarketPriceData> = env.invoke_contract(
            oracle,
            &symbol_short!("lastprice"),
            soroban_sdk::vec![env, soroban_sdk::IntoVal::into_val(&asset, env)],
        );

        let price_data = result.expect("oracle: no settlement price available");

        let now = env.ledger().timestamp();

        // Freshness: price must be recent relative to now (15 min window).
        if now > price_data.timestamp + 900 {
            panic!("oracle: settlement price too stale");
        }

        // Near-expiry constraint: the oracle's own published timestamp must
        // be within 30 min after the expiry. Prevents a late settler from
        // anchoring to a price published long after the option matured.
        // Allow up to 30 min BEFORE expiry too — Reflector updates ~every
        // 5 min, so the closest sample to expiry might be a few minutes
        // either side.
        if price_data.timestamp + 1800 < expiry {
            panic!("oracle: price too far before expiry");
        }
        if price_data.timestamp > expiry + 1800 {
            panic!("oracle: price too far after expiry");
        }

        if price_data.price <= 0 {
            panic!("oracle: invalid settlement price");
        }

        // Convert from Reflector's 14-decimal to our 7-decimal (divide by 10^7)
        price_data.price / 10_000_000
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
