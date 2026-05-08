//! MockUSDC — mintable SEP-41 token for Strix Protocol testnet.
//!
//! Implements the full Soroban token interface so it can be used anywhere
//! a standard token is expected (vault deposit, option premium transfer).
//! The admin key can call `mint` to distribute test USDC to any address.

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    symbol_short,
    token::TokenInterface,
    Address, Env, String,
};

// ── Storage keys ───────────────────────────────────────────────────────────

#[contracttype]
pub struct AllowanceKey {
    pub from:    Address,
    pub spender: Address,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Initialized,
    Decimal,
    TknName,
    TknSymbol,
    Balance(Address),
    Allowance(AllowanceKey),
}

// ── Contract ───────────────────────────────────────────────────────────────

#[contract]
pub struct MockToken;

// ── SEP-41 token interface ─────────────────────────────────────────────────

#[contractimpl]
impl TokenInterface for MockToken {

    fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        env.storage()
            .temporary()
            .get(&DataKey::Allowance(AllowanceKey { from, spender }))
            .unwrap_or(0)
    }

    fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
        expiration_ledger: u32,
    ) {
        from.require_auth();
        let key = DataKey::Allowance(AllowanceKey {
            from:    from.clone(),
            spender: spender.clone(),
        });
        if amount == 0 {
            env.storage().temporary().remove(&key);
        } else {
            env.storage().temporary().set(&key, &amount);
            let current = env.ledger().sequence();
            let live = expiration_ledger.saturating_sub(current);
            if live > 0 {
                env.storage().temporary().extend_ttl(&key, live, live);
            }
        }
        env.events().publish(
            (symbol_short!("approve"), from, spender),
            (amount, expiration_ledger),
        );
    }

    fn balance(env: Env, id: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(id))
            .unwrap_or(0)
    }

    fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        move_balance(&env, &from, &to, amount);
        env.events().publish((symbol_short!("transfer"), from, to), amount);
    }

    fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        amount: i128,
    ) {
        spender.require_auth();
        let key = DataKey::Allowance(AllowanceKey {
            from:    from.clone(),
            spender: spender.clone(),
        });
        let allowance: i128 = env.storage().temporary().get(&key).unwrap_or(0);
        assert!(allowance >= amount, "insufficient allowance");
        env.storage().temporary().set(&key, &(allowance - amount));
        move_balance(&env, &from, &to, amount);
        env.events().publish((symbol_short!("transfer"), from, to), amount);
    }

    fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        let bal: i128 = env.storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);
        assert!(bal >= amount, "insufficient balance");
        env.storage().persistent().set(&DataKey::Balance(from.clone()), &(bal - amount));
        env.storage().persistent().extend_ttl(&DataKey::Balance(from.clone()), 100_000, 1_000_000);
        env.events().publish((symbol_short!("burn"), from), amount);
    }

    fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        let key = DataKey::Allowance(AllowanceKey {
            from:    from.clone(),
            spender: spender.clone(),
        });
        let allowance: i128 = env.storage().temporary().get(&key).unwrap_or(0);
        assert!(allowance >= amount, "insufficient allowance");
        env.storage().temporary().set(&key, &(allowance - amount));
        let bal: i128 = env.storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);
        assert!(bal >= amount, "insufficient balance");
        env.storage().persistent().set(&DataKey::Balance(from.clone()), &(bal - amount));
        env.storage().persistent().extend_ttl(&DataKey::Balance(from.clone()), 100_000, 1_000_000);
        env.events().publish((symbol_short!("burn"), from), amount);
    }

    fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Decimal).unwrap_or(7)
    }

    fn name(env: Env) -> String {
        env.storage().instance().get(&DataKey::TknName).expect("not initialized")
    }

    fn symbol(env: Env) -> String {
        env.storage().instance().get(&DataKey::TknSymbol).expect("not initialized")
    }
}

// ── Admin functions ────────────────────────────────────────────────────────

#[contractimpl]
impl MockToken {
    /// One-time setup. Sets the admin, decimals, name, and symbol.
    pub fn initialize(
        env:     Env,
        admin:   Address,
        decimal: u32,
        name:    String,
        symbol:  String,
    ) {
        assert!(
            !env.storage().instance().has(&DataKey::Initialized),
            "already initialized"
        );
        env.storage().instance().set(&DataKey::Admin,       &admin);
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::Decimal,     &decimal);
        env.storage().instance().set(&DataKey::TknName,     &name);
        env.storage().instance().set(&DataKey::TknSymbol,   &symbol);
        env.storage().instance().extend_ttl(100_000, 1_000_000);
    }

    /// Mint tokens to any address. Only callable by the admin.
    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin: Address = env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();
        assert!(amount > 0, "amount must be positive");

        let bal: i128 = env.storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);
        env.storage().persistent().set(&DataKey::Balance(to.clone()), &(bal + amount));
        env.storage().persistent().extend_ttl(&DataKey::Balance(to.clone()), 100_000, 1_000_000);

        env.events().publish((symbol_short!("mint"), to), amount);
    }

    /// Return the current admin address.
    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).expect("not initialized")
    }

    /// Transfer admin to a new address.
    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        env.storage().instance().extend_ttl(100_000, 1_000_000);
    }
}

// ── Internal helpers ───────────────────────────────────────────────────────

fn move_balance(env: &Env, from: &Address, to: &Address, amount: i128) {
    assert!(amount > 0, "amount must be positive");
    let from_bal: i128 = env.storage()
        .persistent()
        .get(&DataKey::Balance(from.clone()))
        .unwrap_or(0);
    assert!(from_bal >= amount, "insufficient balance");
    env.storage().persistent().set(&DataKey::Balance(from.clone()), &(from_bal - amount));
    env.storage().persistent().extend_ttl(&DataKey::Balance(from.clone()), 100_000, 1_000_000);

    let to_bal: i128 = env.storage()
        .persistent()
        .get(&DataKey::Balance(to.clone()))
        .unwrap_or(0);
    env.storage().persistent().set(&DataKey::Balance(to.clone()), &(to_bal + amount));
    env.storage().persistent().extend_ttl(&DataKey::Balance(to.clone()), 100_000, 1_000_000);
}
