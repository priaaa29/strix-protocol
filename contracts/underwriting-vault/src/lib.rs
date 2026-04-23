#![no_std]

mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contractimpl, symbol_short, token, Address, Env,
};

use types::{DataKey, LpInfo, VaultConfig, VaultInfo};

/// Initial share price: 1 USDC per share (7-decimal precision).
const INITIAL_SHARE_PRICE: i128 = 10_000_000;

/// 7-decimal scale factor.
const SCALE: i128 = 10_000_000;

// ─── Share Math ───────────────────────────────────────────────────────────────

/// Calculate current share price: total_deposits / total_shares.
///
/// Returns INITIAL_SHARE_PRICE (1.0) when no shares exist.
fn share_price(total_deposits: i128, total_shares: i128) -> i128 {
    if total_shares == 0 {
        return INITIAL_SHARE_PRICE;
    }
    // (total_deposits * SCALE) / total_shares — 7-decimal result
    total_deposits
        .checked_mul(SCALE)
        .expect("overflow in share_price")
        / total_shares
}

/// Calculate how many shares a USDC deposit receives.
///
/// First deposit: 1:1 (amount shares for amount USDC).
/// Subsequent: proportional to current share price.
fn shares_for_deposit(amount: i128, total_deposits: i128, total_shares: i128) -> i128 {
    if total_shares == 0 {
        // Bootstrap: 1 share per USDC (since USDC is already 7-decimal,
        // shares also use 7-decimal — e.g. 1000 USDC → 10_000_000_000 shares).
        return amount;
    }
    // amount * total_shares / total_deposits
    amount
        .checked_mul(total_shares)
        .expect("overflow in shares_for_deposit")
        / total_deposits
}

/// Calculate how much USDC a share redemption receives.
fn usdc_for_shares(shares: i128, total_deposits: i128, total_shares: i128) -> i128 {
    if total_shares == 0 {
        return 0;
    }
    // shares * total_deposits / total_shares
    shares
        .checked_mul(total_deposits)
        .expect("overflow in usdc_for_shares")
        / total_shares
}

// ─── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct UnderwritingVault;

#[contractimpl]
impl UnderwritingVault {
    /// Initialize the vault.
    ///
    /// Must be called exactly once immediately after deployment.
    ///
    /// # Arguments
    /// * `admin`      — administrator address
    /// * `usdc_token` — SAC-wrapped USDC contract address
    /// * `max_tvl`    — maximum deposit cap in 7-decimal USDC
    pub fn initialize(env: Env, admin: Address, usdc_token: Address, max_tvl: i128) {
        if env.storage().instance().has(&DataKey::Config) {
            let cfg: VaultConfig = env.storage().instance().get(&DataKey::Config).unwrap();
            if cfg.initialized {
                panic!("already initialized");
            }
        }

        admin.require_auth();

        if max_tvl <= 0 {
            panic!("invalid max_tvl");
        }

        let config = VaultConfig {
            admin,
            usdc_token,
            // Placeholder — must be set via set_option_market before locking
            option_market: env.current_contract_address(),
            total_shares: 0,
            total_deposits: 0,
            locked_capital: 0,
            max_tvl,
            initialized: true,
        };

        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().extend_ttl(100_000, 1_000_000);
    }

    /// Set the authorized OptionMarket contract address (admin-only).
    ///
    /// Must be called before any capital locking occurs.
    pub fn set_option_market(env: Env, admin: Address, option_market: Address) {
        admin.require_auth();

        let mut config: VaultConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        if config.admin != admin {
            panic!("unauthorized");
        }

        config.option_market = option_market.clone();
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().extend_ttl(100_000, 1_000_000);

        env.events()
            .publish((symbol_short!("SET_MKT"),), (option_market,));
    }

    /// Deposit USDC into the vault and receive shares.
    ///
    /// # Arguments
    /// * `depositor` — LP address (must have authorized the transfer)
    /// * `amount`    — USDC amount to deposit, 7-decimal
    ///
    /// Returns number of shares minted.
    pub fn deposit(env: Env, depositor: Address, amount: i128) -> i128 {
        depositor.require_auth();

        if amount <= 0 {
            panic!("deposit amount must be positive");
        }

        let mut config: VaultConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        // Enforce TVL cap
        if config.total_deposits + amount > config.max_tvl {
            panic!("deposit exceeds max TVL");
        }

        // Transfer USDC from depositor to vault
        let usdc = token::Client::new(&env, &config.usdc_token);
        usdc.transfer(&depositor, &env.current_contract_address(), &amount);

        // Calculate shares to mint
        let shares = shares_for_deposit(amount, config.total_deposits, config.total_shares);
        if shares <= 0 {
            panic!("zero shares calculated");
        }

        // Update state
        config.total_deposits += amount;
        config.total_shares += shares;
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().extend_ttl(100_000, 1_000_000);

        // Update user share balance
        let current_shares: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::UserShares(depositor.clone()))
            .unwrap_or(0);
        let new_shares = current_shares + shares;
        env.storage()
            .persistent()
            .set(&DataKey::UserShares(depositor.clone()), &new_shares);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::UserShares(depositor.clone()), 100_000, 1_000_000);

        env.events().publish(
            (symbol_short!("DEPOSIT"), depositor),
            (amount, shares),
        );

        shares
    }

    /// Withdraw USDC by redeeming shares.
    ///
    /// Reverts if insufficient unlocked capital is available.
    ///
    /// # Arguments
    /// * `withdrawer` — LP address
    /// * `shares`     — number of shares to redeem
    ///
    /// Returns USDC amount returned.
    pub fn withdraw(env: Env, withdrawer: Address, shares: i128) -> i128 {
        withdrawer.require_auth();

        if shares <= 0 {
            panic!("shares must be positive");
        }

        let mut config: VaultConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        // Check user has enough shares
        let user_shares: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::UserShares(withdrawer.clone()))
            .unwrap_or(0);

        if user_shares < shares {
            panic!("insufficient shares");
        }

        // Calculate USDC to return
        let usdc_out = usdc_for_shares(shares, config.total_deposits, config.total_shares);
        if usdc_out <= 0 {
            panic!("zero USDC calculated");
        }

        // Check available (unlocked) capital
        let available = config.total_deposits - config.locked_capital;
        if usdc_out > available {
            panic!("insufficient unlocked capital");
        }

        // Update state
        config.total_deposits -= usdc_out;
        config.total_shares -= shares;
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().extend_ttl(100_000, 1_000_000);

        // Burn user shares
        let remaining = user_shares - shares;
        if remaining == 0 {
            env.storage()
                .persistent()
                .remove(&DataKey::UserShares(withdrawer.clone()));
        } else {
            env.storage()
                .persistent()
                .set(&DataKey::UserShares(withdrawer.clone()), &remaining);
            env.storage()
                .persistent()
                .extend_ttl(&DataKey::UserShares(withdrawer.clone()), 100_000, 1_000_000);
        }

        // Transfer USDC to withdrawer
        let usdc = token::Client::new(&env, &config.usdc_token);
        usdc.transfer(&env.current_contract_address(), &withdrawer, &usdc_out);

        env.events().publish(
            (symbol_short!("WITHDRAW"), withdrawer),
            (shares, usdc_out),
        );

        usdc_out
    }

    /// Lock capital to back an option position (OptionMarket-only).
    ///
    /// Caller must be the authorized OptionMarket contract.
    pub fn lock_capital(env: Env, caller: Address, amount: i128) {
        caller.require_auth();

        let mut config: VaultConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        if config.option_market != caller {
            panic!("unauthorized: caller is not option_market");
        }

        if amount <= 0 {
            panic!("lock amount must be positive");
        }

        let available = config.total_deposits - config.locked_capital;
        if amount > available {
            panic!("insufficient capital to lock");
        }

        config.locked_capital += amount;
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().extend_ttl(100_000, 1_000_000);

        env.events()
            .publish((symbol_short!("LOCK"),), (amount,));
    }

    /// Release previously locked capital (OptionMarket-only).
    ///
    /// Called when an option expires OTM or is settled.
    pub fn release_capital(env: Env, caller: Address, amount: i128) {
        caller.require_auth();

        let mut config: VaultConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        if config.option_market != caller {
            panic!("unauthorized: caller is not option_market");
        }

        if amount <= 0 {
            panic!("release amount must be positive");
        }

        if amount > config.locked_capital {
            panic!("release exceeds locked capital");
        }

        config.locked_capital -= amount;
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().extend_ttl(100_000, 1_000_000);

        env.events()
            .publish((symbol_short!("RELEASE"),), (amount,));
    }

    /// Record an incoming premium payment (OptionMarket-only).
    ///
    /// The USDC transfer must have already occurred (OptionMarket transfers
    /// premium from buyer directly to vault, then calls this to update accounting).
    pub fn receive_premium(env: Env, caller: Address, amount: i128) {
        caller.require_auth();

        let mut config: VaultConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        if config.option_market != caller {
            panic!("unauthorized: caller is not option_market");
        }

        if amount <= 0 {
            panic!("premium must be positive");
        }

        // Premium increases TVL, raising share price for existing LPs
        config.total_deposits += amount;
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().extend_ttl(100_000, 1_000_000);

        env.events()
            .publish((symbol_short!("PREMIUM"),), (amount,));
    }

    /// Pay out a settled ITM option (OptionMarket-only).
    ///
    /// Transfers USDC from vault to the option holder and releases locked capital.
    pub fn pay_settlement(env: Env, caller: Address, recipient: Address, amount: i128, locked: i128) {
        caller.require_auth();

        let mut config: VaultConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        if config.option_market != caller {
            panic!("unauthorized: caller is not option_market");
        }

        if amount < 0 {
            panic!("settlement amount must be non-negative");
        }

        if locked < 0 || locked > config.locked_capital {
            panic!("invalid locked amount");
        }

        if amount > 0 {
            if amount > config.total_deposits {
                panic!("insufficient vault funds for settlement");
            }

            // Transfer USDC to the recipient
            let usdc = token::Client::new(&env, &config.usdc_token);
            usdc.transfer(&env.current_contract_address(), &recipient, &amount);

            config.total_deposits -= amount;
        }

        // Release the locked capital for this position
        if locked > 0 {
            config.locked_capital -= locked;
        }

        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().extend_ttl(100_000, 1_000_000);

        env.events().publish(
            (symbol_short!("SETTLE"),),
            (recipient, amount, locked),
        );
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    /// Get current vault state snapshot.
    pub fn get_vault_info(env: Env) -> VaultInfo {
        let config: VaultConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        let available = config.total_deposits - config.locked_capital;
        let sp = share_price(config.total_deposits, config.total_shares);

        VaultInfo {
            tvl: config.total_deposits,
            total_shares: config.total_shares,
            locked: config.locked_capital,
            available,
            share_price: sp,
        }
    }

    /// Get LP-specific information for a given address.
    pub fn get_lp_info(env: Env, lp: Address) -> LpInfo {
        let config: VaultConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        let shares: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::UserShares(lp))
            .unwrap_or(0);

        let usdc_value = usdc_for_shares(shares, config.total_deposits, config.total_shares);

        let share_of_pool_bps = if config.total_shares == 0 {
            0
        } else {
            // bps = shares / total_shares * 10000
            (shares * 10_000 / config.total_shares) as u64
        };

        LpInfo {
            shares,
            usdc_value,
            share_of_pool_bps,
        }
    }

    /// Returns the amount of USDC available (not locked) in the vault.
    pub fn available_capital(env: Env) -> i128 {
        let config: VaultConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        config.total_deposits - config.locked_capital
    }

    /// Returns the current share price in 7-decimal USDC.
    pub fn share_price(env: Env) -> i128 {
        let config: VaultConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        share_price(config.total_deposits, config.total_shares)
    }
}
