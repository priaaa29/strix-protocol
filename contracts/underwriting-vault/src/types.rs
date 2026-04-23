use soroban_sdk::{contracttype, Address};

/// Full vault configuration and state stored in instance storage.
#[contracttype]
#[derive(Clone)]
pub struct VaultConfig {
    /// Administrator address.
    pub admin: Address,
    /// SAC-wrapped USDC token contract address.
    pub usdc_token: Address,
    /// Authorized OptionMarket contract that may lock/release capital.
    pub option_market: Address,
    /// Total LP shares outstanding (7-decimal, but treated as integer units).
    pub total_shares: i128,
    /// Total USDC deposited (TVL), including accrued premiums, 7-decimal.
    pub total_deposits: i128,
    /// USDC locked as collateral for open positions, 7-decimal.
    pub locked_capital: i128,
    /// Maximum TVL cap to prevent over-concentration risk, 7-decimal.
    pub max_tvl: i128,
    /// Whether the contract has been initialized.
    pub initialized: bool,
}

/// Snapshot of vault state returned by `get_vault_info`.
#[contracttype]
#[derive(Clone)]
pub struct VaultInfo {
    /// Total USDC in vault (deposits + premiums - payouts), 7-decimal.
    pub tvl: i128,
    /// Total shares outstanding.
    pub total_shares: i128,
    /// USDC locked as option collateral, 7-decimal.
    pub locked: i128,
    /// USDC available for new options or withdrawals, 7-decimal.
    pub available: i128,
    /// Current price per share in USDC, 7-decimal (1.0000000 = 10_000_000).
    pub share_price: i128,
}

/// LP-specific information returned by `get_lp_info`.
#[contracttype]
#[derive(Clone)]
pub struct LpInfo {
    /// Number of shares held by this LP.
    pub shares: i128,
    /// Current USDC value of those shares, 7-decimal.
    pub usdc_value: i128,
    /// LP's share of pool in basis points (e.g. 5000 = 50.00%).
    pub share_of_pool_bps: u64,
}

/// Storage keys for persistent and instance storage.
#[contracttype]
pub enum DataKey {
    /// Vault configuration (instance storage).
    Config,
    /// Per-user share balances (persistent storage).
    UserShares(Address),
}
