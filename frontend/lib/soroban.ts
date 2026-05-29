// Strix Protocol — Soroban RPC interaction helpers
// All contract interactions go through this module.

import {
  Contract,
  Networks,
  rpc,
  Transaction,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  nativeToScVal,
  scValToNative,
  Address,
} from '@stellar/stellar-sdk';
import { NETWORK_CONFIG, CONTRACT_IDS, ACTIVE_NETWORK } from './constants';
import type {
  VaultInfo,
  LpInfo,
  Position,
  StrikeInfo,
  TxResult,
  SettlementInfo,
} from './types';

// ── RPC Server ─────────────────────────────────────────────────────────────

export function getRpcServer(): rpc.Server {
  return new rpc.Server(NETWORK_CONFIG.rpcUrl, { allowHttp: false });
}

// ── Network Passphrase ─────────────────────────────────────────────────────

export function getNetworkPassphrase(): string {
  return ACTIVE_NETWORK === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;
}

// ── Contract Simulation ────────────────────────────────────────────────────

/**
 * Simulate a contract function call (read-only, no signature needed).
 * Returns the native JS value decoded from the ScVal result.
 */
export async function readContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = []
): Promise<unknown> {
  const server = getRpcServer();

  // Use the deployed admin account as simulation source (it's funded on testnet).
  const simSource = process.env.NEXT_PUBLIC_ADMIN_ADDRESS
    || 'GC74PVJTC4FQRYFAJVFAPUXPBKGBAJIUN7KO7FMCWXMV5X3EWWP7KM6O';

  const account = await server.getAccount(simSource).catch(() => {
    throw new Error('Soroban RPC unreachable — check network connection');
  });

  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(`Contract call failed: ${simResult.error}`);
  }

  if (!('result' in simResult) || !simResult.result) {
    return null;
  }

  return scValToNative(simResult.result.retval);
}

/**
 * Build a transaction, simulate, then submit via Freighter.
 * Returns the transaction hash on success.
 */
export async function buildAndSubmitTx(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  sourceAddress: string
): Promise<TxResult> {
  const server = getRpcServer();

  try {
    const account = await server.getAccount(sourceAddress);

    const contract = new Contract(contractId);
    let tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: getNetworkPassphrase(),
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    // Simulate first to get resource usage + footprint
    const simResult = await server.simulateTransaction(tx);

    if (rpc.Api.isSimulationError(simResult)) {
      return {
        hash: '',
        status: 'failed',
        error: parseContractError(simResult.error),
      };
    }

    // Assemble with simulation results
    const assembled = rpc.assembleTransaction(tx, simResult).build();

    // Sign via whichever wallet the user connected (Freighter, xBull, Lobstr, etc.)
    // Import from /sdk to share the same static instance that useWallet initializes.
    const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit/sdk');
    const { signedTxXdr: signedXdr } = await StellarWalletsKit.signTransaction(
      assembled.toXDR(),
      {
        networkPassphrase: getNetworkPassphrase(),
        address: sourceAddress,
      }
    );

    // Deserialize and submit
    const signedTx = TransactionBuilder.fromXDR(
      signedXdr,
      getNetworkPassphrase()
    ) as Transaction;

    const sendResult = await server.sendTransaction(signedTx);

    if (sendResult.status === 'ERROR') {
      return {
        hash: sendResult.hash,
        status: 'failed',
        error: 'Transaction rejected by network',
      };
    }

    // Poll for confirmation
    const hash = sendResult.hash;
    let attempts = 0;
    while (attempts < 30) {
      await new Promise((r) => setTimeout(r, 2000));
      const status = await server.getTransaction(hash);

      if (status.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        return { hash, status: 'confirmed' };
      }
      if (status.status === rpc.Api.GetTransactionStatus.FAILED) {
        return {
          hash,
          status: 'failed',
          error: 'Transaction execution failed on-chain',
        };
      }
      attempts++;
    }

    return { hash, status: 'failed', error: 'Transaction confirmation timeout' };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { hash: '', status: 'failed', error: parseContractError(error) };
  }
}

/**
 * Build + sign a contract call exactly like buildAndSubmitTx, but submit
 * the signed inner XDR to /api/sponsor for fee-bump wrapping by the
 * protocol sponsor account. User pays no XLM fee.
 *
 * Only contracts where the sponsor has whitelisted the method (currently
 * OptionMarket.buy_call and OptionMarket.buy_put) will succeed; everything
 * else returns 400 from the API.
 */
export async function buildAndSubmitSponsoredTx(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  sourceAddress: string
): Promise<TxResult> {
  const server = getRpcServer();

  try {
    const account = await server.getAccount(sourceAddress);
    const contract = new Contract(contractId);
    let tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: getNetworkPassphrase(),
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const simResult = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(simResult)) {
      return { hash: '', status: 'failed', error: parseContractError(simResult.error) };
    }
    const assembled = rpc.assembleTransaction(tx, simResult).build();

    const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit/sdk');
    const { signedTxXdr: signedXdr } = await StellarWalletsKit.signTransaction(
      assembled.toXDR(),
      { networkPassphrase: getNetworkPassphrase(), address: sourceAddress }
    );

    // Submit to sponsor endpoint instead of the network directly
    const sponsorRes = await fetch('/api/sponsor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ innerXdr: signedXdr }),
    });

    const sponsorJson = await sponsorRes.json().catch(() => ({}));
    if (!sponsorRes.ok || !sponsorJson.hash) {
      return {
        hash: '',
        status: 'failed',
        error: sponsorJson.error || `Sponsor service returned ${sponsorRes.status}`,
      };
    }

    // Poll for confirmation — same logic as buildAndSubmitTx
    const hash = sponsorJson.hash as string;
    let attempts = 0;
    while (attempts < 30) {
      await new Promise((r) => setTimeout(r, 2000));
      const status = await server.getTransaction(hash);
      if (status.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        return { hash, status: 'confirmed' };
      }
      if (status.status === rpc.Api.GetTransactionStatus.FAILED) {
        return { hash, status: 'failed', error: 'Transaction execution failed on-chain' };
      }
      attempts++;
    }
    return { hash, status: 'failed', error: 'Transaction confirmation timeout' };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { hash: '', status: 'failed', error: parseContractError(error) };
  }
}

/** Sponsored variants of buy_call / buy_put — fee paid by the protocol sponsor. */
export async function buyCallSponsored(
  buyer: string,
  strike: bigint,
  expiry: number,
  amount: number
): Promise<TxResult> {
  return buildAndSubmitSponsoredTx(
    CONTRACT_IDS.optionMarket,
    'buy_call',
    [
      new Address(buyer).toScVal(),
      nativeToScVal(strike, { type: 'i128' }),
      nativeToScVal(expiry, { type: 'u64' }),
      nativeToScVal(amount, { type: 'u64' }),
    ],
    buyer
  );
}

export async function buyPutSponsored(
  buyer: string,
  strike: bigint,
  expiry: number,
  amount: number
): Promise<TxResult> {
  return buildAndSubmitSponsoredTx(
    CONTRACT_IDS.optionMarket,
    'buy_put',
    [
      new Address(buyer).toScVal(),
      nativeToScVal(strike, { type: 'i128' }),
      nativeToScVal(expiry, { type: 'u64' }),
      nativeToScVal(amount, { type: 'u64' }),
    ],
    buyer
  );
}

// ── High-level Contract Calls ──────────────────────────────────────────────

/** Fetch vault state. */
export async function getVaultInfo(): Promise<VaultInfo> {
  const raw = (await readContract(CONTRACT_IDS.vault, 'get_vault_info')) as Record<string, unknown>;
  return {
    tvl: BigInt(raw.tvl as bigint | number),
    totalShares: BigInt(raw.total_shares as bigint | number),
    locked: BigInt(raw.locked as bigint | number),
    available: BigInt(raw.available as bigint | number),
    sharePrice: BigInt(raw.share_price as bigint | number),
  };
}

/** Fetch LP info for a specific address. */
export async function getLpInfo(address: string): Promise<LpInfo> {
  const raw = (await readContract(CONTRACT_IDS.vault, 'get_lp_info', [
    new Address(address).toScVal(),
  ])) as Record<string, unknown>;
  return {
    shares: BigInt(raw.shares as bigint | number),
    usdcValue: BigInt(raw.usdc_value as bigint | number),
    shareOfPoolBps: Number(raw.share_of_pool_bps as bigint | number),
  };
}

/** Fetch spot price from pricing engine. */
export async function getSpotPrice(): Promise<bigint> {
  const raw = await readContract(CONTRACT_IDS.pricingEngine, 'get_spot_price');
  return BigInt(raw as bigint | number);
}

/** Fetch active strikes for a given expiry. */
export async function getStrikes(expiry: number): Promise<StrikeInfo[]> {
  const raw = (await readContract(CONTRACT_IDS.optionMarket, 'get_strikes', [
    nativeToScVal(expiry, { type: 'u64' }),
  ])) as Array<Record<string, unknown>>;

  return raw.map((s) => ({
    strike: BigInt(s.strike as bigint | number),
    expiry: Number(s.expiry as bigint | number),
    callPremium: BigInt(s.call_premium as bigint | number),
    putPremium: BigInt(s.put_premium as bigint | number),
  }));
}

/**
 * Compute live premiums for a list of strikes by calling the PricingEngine directly.
 * Premiums stored in the contract are 0 (computed on demand to stay within budget).
 * This makes parallel RPC simulation calls — one per strike per option type.
 */
export async function fetchLivePremiums(
  strikes: StrikeInfo[],
  expiry: number
): Promise<StrikeInfo[]> {
  if (strikes.length === 0) return strikes;

  // Each is an independent simulation — no on-chain budget constraint
  const premiumResults = await Promise.all(
    strikes.map(async (s) => {
      const [callRaw, putRaw] = await Promise.all([
        readContract(CONTRACT_IDS.pricingEngine, 'calc_call_premium', [
          nativeToScVal(s.strike, { type: 'i128' }),
          nativeToScVal(expiry, { type: 'u64' }),
          nativeToScVal(1, { type: 'u64' }),
        ]).catch(() => 0),
        readContract(CONTRACT_IDS.pricingEngine, 'calc_put_premium', [
          nativeToScVal(s.strike, { type: 'i128' }),
          nativeToScVal(expiry, { type: 'u64' }),
          nativeToScVal(1, { type: 'u64' }),
        ]).catch(() => 0),
      ]);
      return {
        ...s,
        callPremium: BigInt(callRaw as bigint | number),
        putPremium: BigInt(putRaw as bigint | number),
      };
    })
  );

  return premiumResults;
}

/** Fetch all positions for a user (returns full Position objects). */
export async function getUserPositions(address: string): Promise<Position[]> {
  const ids = (await readContract(CONTRACT_IDS.optionMarket, 'get_user_positions', [
    new Address(address).toScVal(),
  ])) as Array<bigint | number>;

  const positions: Position[] = [];
  for (const id of ids) {
    const pos = await getPosition(Number(id));
    positions.push(pos);
  }
  return positions;
}

/** Fetch a single position by ID. */
export async function getPosition(positionId: number): Promise<Position> {
  const raw = (await readContract(CONTRACT_IDS.optionMarket, 'get_position', [
    nativeToScVal(positionId, { type: 'u64' }),
  ])) as Record<string, unknown>;

  return {
    id: Number(raw.id as bigint | number),
    owner: raw.owner as string,
    optionType: (raw.option_type as Record<string, unknown>).Call !== undefined ? 'Call' : 'Put',
    strike: BigInt(raw.strike as bigint | number),
    expiry: Number(raw.expiry as bigint | number),
    amount: Number(raw.amount as bigint | number),
    premiumPaid: BigInt(raw.premium_paid as bigint | number),
    lockedAmount: BigInt(raw.locked_amount as bigint | number),
    settled: raw.settled as boolean,
    payout: BigInt(raw.payout as bigint | number),
    claimed: raw.claimed as boolean,
  };
}

/** Aggregate protocol-level metrics for the /metrics dashboard. */
export interface ProtocolMetrics {
  tvl: bigint;
  locked: bigint;
  available: bigint;
  sharePrice: bigint;
  totalShares: bigint;
  totalPositions: number;
  paused: boolean;
  spotPrice: bigint;
  oracleAddress: string;
  pricingEngineAddress: string;
  vaultAddress: string;
}

export async function getProtocolMetrics(): Promise<ProtocolMetrics> {
  const [vaultInfo, config, spot] = await Promise.all([
    getVaultInfo(),
    readContract(CONTRACT_IDS.optionMarket, 'get_config'),
    getSpotPrice().catch(() => 0n),
  ]);

  const cfg = config as Record<string, unknown>;

  return {
    tvl: vaultInfo.tvl,
    locked: vaultInfo.locked,
    available: vaultInfo.available,
    sharePrice: vaultInfo.sharePrice,
    totalShares: vaultInfo.totalShares,
    totalPositions: Number(cfg.next_position_id as bigint | number),
    paused: cfg.paused as boolean,
    spotPrice: spot,
    oracleAddress: cfg.oracle as string,
    pricingEngineAddress: cfg.pricing_engine as string,
    vaultAddress: cfg.vault as string,
  };
}

/** Check if an expiry is settled. */
export async function isSettled(expiry: number): Promise<boolean> {
  const raw = await readContract(CONTRACT_IDS.optionMarket, 'is_settled', [
    nativeToScVal(expiry, { type: 'u64' }),
  ]);
  return raw as boolean;
}

/** Get settlement info. */
export async function getSettlement(expiry: number): Promise<SettlementInfo> {
  const raw = (await readContract(CONTRACT_IDS.optionMarket, 'get_settlement', [
    nativeToScVal(expiry, { type: 'u64' }),
  ])) as Record<string, unknown>;

  return {
    settlementPrice: BigInt(raw.settlement_price as bigint | number),
    settledAt: Number(raw.settled_at as bigint | number),
    settledBy: raw.settled_by as string,
  };
}

// ── Mutations ─────────────────────────────────────────────────────────────

/** Deposit USDC to vault. */
export async function depositToVault(
  address: string,
  amount: bigint
): Promise<TxResult> {
  return buildAndSubmitTx(CONTRACT_IDS.vault, 'deposit', [
    new Address(address).toScVal(),
    nativeToScVal(amount, { type: 'i128' }),
  ], address);
}

/** Withdraw from vault. */
export async function withdrawFromVault(
  address: string,
  shares: bigint
): Promise<TxResult> {
  return buildAndSubmitTx(CONTRACT_IDS.vault, 'withdraw', [
    new Address(address).toScVal(),
    nativeToScVal(shares, { type: 'i128' }),
  ], address);
}

/** Buy a call option. */
export async function buyCall(
  buyer: string,
  strike: bigint,
  expiry: number,
  amount: number
): Promise<TxResult> {
  return buildAndSubmitTx(CONTRACT_IDS.optionMarket, 'buy_call', [
    new Address(buyer).toScVal(),
    nativeToScVal(strike, { type: 'i128' }),
    nativeToScVal(expiry, { type: 'u64' }),
    nativeToScVal(amount, { type: 'u64' }),
  ], buyer);
}

/** Buy a put option. */
export async function buyPut(
  buyer: string,
  strike: bigint,
  expiry: number,
  amount: number
): Promise<TxResult> {
  return buildAndSubmitTx(CONTRACT_IDS.optionMarket, 'buy_put', [
    new Address(buyer).toScVal(),
    nativeToScVal(strike, { type: 'i128' }),
    nativeToScVal(expiry, { type: 'u64' }),
    nativeToScVal(amount, { type: 'u64' }),
  ], buyer);
}

/** Settle an expiry. */
export async function settleExpiry(
  caller: string,
  expiry: number
): Promise<TxResult> {
  return buildAndSubmitTx(CONTRACT_IDS.optionMarket, 'settle', [
    new Address(caller).toScVal(),
    nativeToScVal(expiry, { type: 'u64' }),
  ], caller);
}

/** Claim an ITM payout. */
export async function claimPosition(
  owner: string,
  positionId: number
): Promise<TxResult> {
  return buildAndSubmitTx(CONTRACT_IDS.optionMarket, 'claim', [
    new Address(owner).toScVal(),
    nativeToScVal(positionId, { type: 'u64' }),
  ], owner);
}

// ── Error Parsing ──────────────────────────────────────────────────────────

/** Convert raw Soroban errors to human-readable messages. */
export function parseContractError(error: string): string {
  const patterns: [RegExp, string][] = [
    [/market paused/i, 'The options market is currently paused for maintenance.'],
    [/insufficient vault capacity/i, 'The vault does not have enough capital for this position.'],
    [/insufficient shares/i, 'You do not have enough vault shares to withdraw this amount.'],
    [/insufficient unlocked capital/i, 'Some capital is locked in active options. Withdraw amount reduced.'],
    [/deposit exceeds max tvl/i, 'This deposit would exceed the vault\'s maximum capacity.'],
    [/invalid strike/i, 'This strike price is not available for the selected expiry.'],
    [/already settled/i, 'This expiry has already been settled.'],
    [/expiry has not passed/i, 'This expiry date has not arrived yet.'],
    [/already claimed/i, 'This position has already been claimed.'],
    [/not position owner/i, 'You are not the owner of this position.'],
    [/no payout/i, 'This option expired worthless (out-of-the-money).'],
    [/position not yet settled/i, 'This position cannot be claimed until the expiry is settled.'],
    [/oracle.*stale/i, 'The price oracle data is stale. Please try again.'],
    [/zero premium/i, 'Option premium calculated as zero. Please try a different strike.'],
    [/User declined/i, 'Transaction cancelled by user.'],
    [/already initialized/i, 'Contract already initialized.'],
  ];

  for (const [pattern, message] of patterns) {
    if (pattern.test(error)) return message;
  }

  return error || 'An unexpected error occurred. Please try again.';
}
