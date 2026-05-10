use soroban_sdk::{contracttype, Address};

/// Option type: call or put.
#[contracttype]
#[derive(Clone, PartialEq)]
pub enum OptionType {
    Call,
    Put,
}

/// A single option position owned by a trader.
#[contracttype]
#[derive(Clone)]
pub struct Position {
    /// Unique position identifier (auto-incremented).
    pub id: u64,
    /// Owner (trader) address.
    pub owner: Address,
    /// Call or put.
    pub option_type: OptionType,
    /// Strike price in 7-decimal USDC.
    pub strike: i128,
    /// Unix timestamp of option expiry.
    pub expiry: u64,
    /// Number of XLM contracts purchased.
    pub amount: u64,
    /// Premium paid in 7-decimal USDC.
    pub premium_paid: i128,
    /// USDC locked as collateral backing this position, 7-decimal.
    pub locked_amount: i128,
    /// Whether this position has been settled.
    pub settled: bool,
    /// Payout amount after settlement (0 if OTM), 7-decimal USDC.
    pub payout: i128,
    /// Whether the payout has been claimed by the owner.
    pub claimed: bool,
}

/// Settlement record for an expiry timestamp.
#[contracttype]
#[derive(Clone)]
pub struct SettlementInfo {
    /// Oracle price used for settlement, 7-decimal USDC.
    pub settlement_price: i128,
    /// Timestamp when settlement was executed.
    pub settled_at: u64,
    /// Address that called settle().
    pub settled_by: Address,
}

/// Strike information for a given expiry.
#[contracttype]
#[derive(Clone)]
pub struct StrikeInfo {
    /// Strike price, 7-decimal USDC.
    pub strike: i128,
    /// Expiry timestamp this strike belongs to.
    pub expiry: u64,
    /// Cached call premium for UI display (refreshed on epoch creation).
    pub call_premium: i128,
    /// Cached put premium for UI display.
    pub put_premium: i128,
}

/// Core market configuration.
#[contracttype]
#[derive(Clone)]
pub struct MarketConfig {
    /// Administrator address.
    pub admin: Address,
    /// PricingEngine contract address.
    pub pricing_engine: Address,
    /// UnderwritingVault contract address.
    pub vault: Address,
    /// SAC-wrapped USDC token address.
    pub usdc_token: Address,
    /// DIA oracle address.
    pub oracle: Address,
    /// Size of each contract in XLM (7-decimal). Default: 1.0 XLM = 10_000_000.
    pub contract_size: u64,
    /// Emergency pause flag.
    pub paused: bool,
    /// Auto-incrementing position ID counter.
    pub next_position_id: u64,
}

/// Storage keys.
#[contracttype]
pub enum DataKey {
    /// Market configuration (instance storage).
    Config,
    /// Position by ID (persistent storage).
    Position(u64),
    /// List of position IDs owned by an address (persistent storage).
    UserPositions(Address),
    /// Settlement record for an expiry (persistent storage).
    ExpirySettled(u64),
    /// List of position IDs for a given expiry (persistent storage).
    ExpiryPositions(u64),
    /// Active strikes for a given expiry (persistent storage).
    ActiveStrikes(u64),
}
