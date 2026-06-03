#![no_std]

pub mod black_scholes;
pub mod oracle;

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env,
};

use black_scholes::{call_price, put_price, SCALE};

/// 7-decimal fixed-point precision constant.
pub const FIXED_SCALE: i128 = 10_000_000;

/// Seconds in a year (365.25 days) for time-to-expiry calculation.
const SECS_PER_YEAR: i128 = 31_557_600;

/// Minimum premium floor: 0.01 USDC = 100_000 in 7-decimal.
const MIN_PREMIUM: i128 = 100_000;

/// Contract configuration stored in instance storage.
#[contracttype]
#[derive(Clone)]
pub struct PricingConfig {
    /// Contract administrator.
    pub admin: Address,
    /// DIA oracle contract address.
    pub oracle: Address,
    /// Implied volatility in basis points (8000 = 80%).
    pub iv_bps: u64,
    /// Spread in basis points added on top of BS price (e.g. 100 = 1%).
    pub spread_bps: u64,
    /// Whether the contract has been initialized.
    pub initialized: bool,
}

/// Storage keys for instance storage.
#[contracttype]
pub enum DataKey {
    Config,
}

#[contract]
pub struct PricingEngine;

#[contractimpl]
impl PricingEngine {
    /// Initialize the pricing engine.
    ///
    /// Must be called exactly once by the deployer.
    ///
    /// # Arguments
    /// * `admin`      — administrator address (can update IV/spread)
    /// * `oracle`     — DIA oracle contract address
    /// * `iv_bps`     — implied volatility in bps (8000 = 80%)
    /// * `spread_bps` — protocol spread in bps (100 = 1%)
    pub fn initialize(
        env: Env,
        admin: Address,
        oracle: Address,
        iv_bps: u64,
        spread_bps: u64,
    ) {
        // Prevent re-initialization
        if env.storage().instance().has(&DataKey::Config) {
            let cfg: PricingConfig = env.storage().instance().get(&DataKey::Config).unwrap();
            if cfg.initialized {
                panic!("already initialized");
            }
        }

        admin.require_auth();

        let config = PricingConfig {
            admin,
            oracle,
            iv_bps,
            spread_bps,
            initialized: true,
        };

        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().extend_ttl(100_000, 1_000_000);
    }

    /// Calculate call option premium.
    ///
    /// Returns the total premium in 7-decimal USDC for `amount` contracts.
    ///
    /// # Arguments
    /// * `strike`     — option strike price, 7-decimal USDC (e.g. 0.12 = 1_200_000)
    /// * `expiry`     — Unix timestamp of expiry
    /// * `amount`     — number of XLM contracts (each contract = 1 XLM)
    ///
    /// Returns premium in 7-decimal USDC.
    pub fn calc_call_premium(env: Env, strike: i128, expiry: u64, amount: u64) -> i128 {
        if strike <= 0 {
            panic!("strike must be positive");
        }
        if amount == 0 {
            panic!("amount must be positive");
        }

        let config: PricingConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        let spot = oracle::get_xlm_price(&env, &config.oracle);
        let now = env.ledger().timestamp();

        if expiry <= now {
            // At or past expiry: intrinsic value only
            let intrinsic = (spot - strike).max(0);
            let total = intrinsic * amount as i128;
            return total.max(MIN_PREMIUM);
        }

        let time_secs = (expiry - now) as i128;
        let time_years = time_secs * FIXED_SCALE / SECS_PER_YEAR;

        // Convert IV from bps to 7-decimal fraction
        // 8000 bps = 80% = 0.80 → 8_000_000 in 7-decimal
        let iv = (config.iv_bps as i128) * FIXED_SCALE / 10_000;

        let unit_premium = call_price(spot, strike, time_years, iv);

        // Apply spread: premium * (1 + spread_bps / 10000)
        let spread_factor = FIXED_SCALE + (config.spread_bps as i128) * FIXED_SCALE / 10_000;
        let unit_with_spread = unit_premium * spread_factor / FIXED_SCALE;

        // Total premium for all contracts
        let total = unit_with_spread * amount as i128;

        // Enforce minimum premium floor
        total.max(MIN_PREMIUM)
    }

    /// Calculate put option premium.
    ///
    /// Same semantics as `calc_call_premium` but for put options.
    pub fn calc_put_premium(env: Env, strike: i128, expiry: u64, amount: u64) -> i128 {
        if strike <= 0 {
            panic!("strike must be positive");
        }
        if amount == 0 {
            panic!("amount must be positive");
        }

        let config: PricingConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        let spot = oracle::get_xlm_price(&env, &config.oracle);
        let now = env.ledger().timestamp();

        if expiry <= now {
            let intrinsic = (strike - spot).max(0);
            let total = intrinsic * amount as i128;
            return total.max(MIN_PREMIUM);
        }

        let time_secs = (expiry - now) as i128;
        let time_years = time_secs * FIXED_SCALE / SECS_PER_YEAR;

        let iv = (config.iv_bps as i128) * FIXED_SCALE / 10_000;

        let unit_premium = put_price(spot, strike, time_years, iv);

        let spread_factor = FIXED_SCALE + (config.spread_bps as i128) * FIXED_SCALE / 10_000;
        let unit_with_spread = unit_premium * spread_factor / FIXED_SCALE;

        let total = unit_with_spread * amount as i128;

        total.max(MIN_PREMIUM)
    }

    /// Get the current XLM/USDC spot price from the oracle.
    ///
    /// Returns 7-decimal fixed-point USDC price.
    pub fn get_spot_price(env: Env) -> i128 {
        let config: PricingConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        oracle::get_xlm_price(&env, &config.oracle)
    }

    /// Update implied volatility (admin-only).
    ///
    /// # Arguments
    /// * `new_iv_bps` — new IV in basis points (e.g. 8000 = 80%)
    pub fn set_iv(env: Env, admin: Address, new_iv_bps: u64) {
        admin.require_auth();

        let mut config: PricingConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        if config.admin != admin {
            panic!("unauthorized: not admin");
        }

        config.iv_bps = new_iv_bps;
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().extend_ttl(100_000, 1_000_000);

        env.events().publish(
            (symbol_short!("SET_IV"),),
            (new_iv_bps,),
        );
    }

    /// Update protocol spread (admin-only).
    ///
    /// # Arguments
    /// * `new_spread_bps` — new spread in basis points (e.g. 100 = 1%)
    pub fn set_spread(env: Env, admin: Address, new_spread_bps: u64) {
        admin.require_auth();

        let mut config: PricingConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        if config.admin != admin {
            panic!("unauthorized: not admin");
        }

        config.spread_bps = new_spread_bps;
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().extend_ttl(100_000, 1_000_000);

        env.events().publish(
            (symbol_short!("SET_SPR"),),
            (new_spread_bps,),
        );
    }

    /// Get current pricing configuration.
    pub fn get_config(env: Env) -> PricingConfig {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized")
    }
}
