/**
 * /api/sponsor — Fee-bump sponsorship endpoint
 *
 * Accepts a user-signed inner transaction XDR and wraps it in a fee-bump
 * envelope paid by the sponsor account. Lets users buy options without
 * holding any XLM for gas — the protocol covers the network fee.
 *
 * Validation:
 *   1. Inner tx must contain exactly one operation
 *   2. Operation must invoke our deployed OptionMarket contract
 *   3. Function called must be buy_call or buy_put
 *   4. Caller wallet must be under the daily rate limit
 *
 * Anti-abuse:
 *   - Rate limited by source account (5 sponsored txs per wallet per 24h)
 *   - Sponsor balance threshold check (returns 503 below 1000 XLM)
 *   - In-memory counter; resets on cold start (acceptable for testnet)
 *
 * Env vars (set in Vercel project settings):
 *   SPONSOR_SECRET_KEY      — sponsor account secret (DO NOT COMMIT)
 *   NEXT_PUBLIC_OPTION_MARKET_ID — already set for frontend
 *   NEXT_PUBLIC_RPC_URL     — already set for frontend
 *   NEXT_PUBLIC_NETWORK     — testnet | mainnet
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  Keypair,
  Networks,
  TransactionBuilder,
  FeeBumpTransaction,
  Transaction,
  Operation,
  BASE_FEE,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';

export const runtime = 'nodejs';

const SPONSOR_SECRET = process.env.SPONSOR_SECRET_KEY;
const OPTION_MARKET_ID = process.env.NEXT_PUBLIC_OPTION_MARKET_ID || '';
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://soroban-testnet.stellar.org';
const ACTIVE_NETWORK = (process.env.NEXT_PUBLIC_NETWORK as string) || 'testnet';
const PASSPHRASE = ACTIVE_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
const HORIZON_URL = ACTIVE_NETWORK === 'mainnet'
  ? 'https://horizon.stellar.org'
  : 'https://horizon-testnet.stellar.org';

// Allowed contract methods that the sponsor will pay for
const ALLOWED_METHODS = new Set(['buy_call', 'buy_put']);

// Per-wallet rate limit: 5 sponsored txs per source wallet per 24h.
// Note: trivially bypassable by minting fresh keypairs — the per-wallet
// limit is a UX guardrail, not a security control. The global guard below
// (and the on-chain sponsor balance check) are what actually bound sponsor
// spend.
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const sponsorshipLog = new Map<string, number[]>();

// Global daily ceiling: no more than N sponsored txs/day across the entire
// service. Defends against the sybil mint-fresh-keypair attack the per-wallet
// limit can't see. In-memory and per-Vercel-region (cold-starts reset it) —
// for production this should be backed by a shared KV (Upstash / Vercel KV).
// Today the on-chain sponsor balance check is the hard backstop.
const GLOBAL_DAILY_CAP = 500;
let globalTimestamps: number[] = [];

// Minimum sponsor XLM balance below which we stop sponsoring (1000 XLM headroom)
const MIN_SPONSOR_BALANCE_XLM = 1000;

function err(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

function isUnderRateLimit(address: string): { ok: boolean; remaining: number } {
  const now = Date.now();
  const history = (sponsorshipLog.get(address) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  sponsorshipLog.set(address, history);
  return {
    ok: history.length < RATE_LIMIT_MAX,
    remaining: Math.max(0, RATE_LIMIT_MAX - history.length),
  };
}

function isUnderGlobalCap(): boolean {
  const now = Date.now();
  globalTimestamps = globalTimestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  return globalTimestamps.length < GLOBAL_DAILY_CAP;
}

function recordSponsorship(address: string) {
  const history = sponsorshipLog.get(address) || [];
  const now = Date.now();
  history.push(now);
  sponsorshipLog.set(address, history);
  globalTimestamps.push(now);
}

function refundSponsorship(address: string) {
  // Pop the most recent entry from both counters — used when submission fails
  // before the sponsor's XLM was actually spent.
  const history = sponsorshipLog.get(address) || [];
  history.pop();
  sponsorshipLog.set(address, history);
  globalTimestamps.pop();
}

/**
 * Fetch the sponsor account's native XLM balance from Horizon. Soroban RPC
 * `getAccount` returns an AccountEntry but no balance, so we use Horizon for
 * this. Returns -1 on any error so the caller can fail closed.
 */
async function fetchNativeXlmBalance(publicKey: string): Promise<number> {
  try {
    const res = await fetch(`${HORIZON_URL}/accounts/${publicKey}`, {
      // Short timeout; sponsor service must stay responsive.
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return -1;
    const data = (await res.json()) as {
      balances?: Array<{ asset_type: string; balance: string }>;
    };
    const native = data.balances?.find((b) => b.asset_type === 'native');
    if (!native) return -1;
    const parsed = parseFloat(native.balance);
    return Number.isFinite(parsed) ? parsed : -1;
  } catch {
    return -1;
  }
}

/**
 * Validate that the inner tx is a single invocation of buy_call or buy_put
 * against our deployed OptionMarket contract.
 */
function validateInnerTx(tx: Transaction): { ok: true; method: string } | { ok: false; reason: string } {
  if (tx.operations.length !== 1) {
    return { ok: false, reason: 'Inner tx must contain exactly one operation' };
  }
  const op = tx.operations[0];
  if (op.type !== 'invokeHostFunction') {
    return { ok: false, reason: 'Operation must be invokeHostFunction' };
  }

  // Decode invokeContract from the host function
  const hostFn = (op as Operation.InvokeHostFunction).func;
  if (hostFn.switch() !== xdr.HostFunctionType.hostFunctionTypeInvokeContract()) {
    return { ok: false, reason: 'Host function must be invokeContract' };
  }

  const invoke = hostFn.invokeContract();
  const contractIdScAddr = invoke.contractAddress();
  const contractId = contractIdScAddr.contractId();
  // Encode to strkey format for comparison with OPTION_MARKET_ID
  const { Address } = require('@stellar/stellar-sdk');
  const contractIdStr = Address.contract(contractId).toString();

  if (contractIdStr !== OPTION_MARKET_ID) {
    return {
      ok: false,
      reason: `Contract ${contractIdStr.slice(0, 12)}… is not the sponsored OptionMarket`,
    };
  }

  const methodName = invoke.functionName().toString();
  if (!ALLOWED_METHODS.has(methodName)) {
    return {
      ok: false,
      reason: `Method '${methodName}' is not sponsored (only buy_call / buy_put)`,
    };
  }

  return { ok: true, method: methodName };
}

export async function POST(req: NextRequest) {
  if (!SPONSOR_SECRET) {
    return err(503, 'Sponsorship temporarily unavailable — sponsor key not configured');
  }
  if (!OPTION_MARKET_ID) {
    return err(500, 'Server misconfigured — OPTION_MARKET_ID not set');
  }

  let body: { innerXdr?: string };
  try {
    body = await req.json();
  } catch {
    return err(400, 'Invalid JSON body');
  }

  const innerXdr = body.innerXdr;
  if (!innerXdr || typeof innerXdr !== 'string') {
    return err(400, 'Missing innerXdr field');
  }

  // Parse + validate inner tx
  let innerTx: Transaction;
  try {
    const parsed = TransactionBuilder.fromXDR(innerXdr, PASSPHRASE);
    if (parsed instanceof FeeBumpTransaction) {
      return err(400, 'Inner tx must not itself be a fee-bump envelope');
    }
    innerTx = parsed as Transaction;
  } catch (e) {
    return err(400, 'Failed to parse innerXdr', {
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  const validation = validateInnerTx(innerTx);
  if (!validation.ok) {
    return err(400, validation.reason);
  }

  // Inner signer == the user. Rate-limit by their source account.
  const userAddress = innerTx.source;
  const rl = isUnderRateLimit(userAddress);
  if (!rl.ok) {
    return err(429, 'Rate limit reached — 5 sponsored txs per wallet per 24h', {
      retry_after_seconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    });
  }

  if (!isUnderGlobalCap()) {
    return err(429, 'Sponsorship quota reached for today — retry tomorrow or pay your own gas', {
      retry_after_seconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    });
  }

  // Hard backstop: read the sponsor account's actual XLM balance from Horizon
  // and fail closed (treat -1 / fetch error as below threshold). Soroban RPC's
  // getAccount does NOT return XLM balance; we must hit Horizon for this.
  const sponsorKp = Keypair.fromSecret(SPONSOR_SECRET);
  const balanceXlm = await fetchNativeXlmBalance(sponsorKp.publicKey());
  if (balanceXlm < 0) {
    return err(503, 'Sponsor balance unavailable — please retry shortly or pay your own gas');
  }
  if (balanceXlm < MIN_SPONSOR_BALANCE_XLM) {
    return err(503, 'Sponsorship pool depleted — please retry later or pay your own gas');
  }

  const server = new rpc.Server(RPC_URL, { allowHttp: false });

  let feeBump: FeeBumpTransaction;
  try {
    feeBump = TransactionBuilder.buildFeeBumpTransaction(
      sponsorKp,
      // Sponsor pays up to 100x base fee for the inner tx — generous bound for Soroban execution
      (BigInt(BASE_FEE) * 100n).toString(),
      innerTx,
      PASSPHRASE
    );
  } catch (e) {
    return err(500, 'Failed to build fee-bump envelope', {
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // Record optimistically before submit — counters are atomic per-process,
  // so doing it after submit risks racing concurrent calls past the cap.
  // We refund both counters if the network rejects the tx below.
  recordSponsorship(userAddress);

  let sendResult: rpc.Api.SendTransactionResponse;
  try {
    sendResult = await server.sendTransaction(feeBump);
  } catch (e) {
    refundSponsorship(userAddress);
    return err(502, 'Failed to submit to RPC', {
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  if (sendResult.status === 'ERROR') {
    refundSponsorship(userAddress);
    return err(400, 'Network rejected the sponsored transaction', {
      sendResult,
    });
  }

  return NextResponse.json({
    status: 'submitted',
    hash: sendResult.hash,
    method: validation.method,
    sponsoredBy: sponsorKp.publicKey(),
    rateLimitRemaining: rl.remaining - 1,
  });
}

export async function GET() {
  const sponsorPub = SPONSOR_SECRET ? Keypair.fromSecret(SPONSOR_SECRET).publicKey() : null;
  const balance = sponsorPub ? await fetchNativeXlmBalance(sponsorPub) : -1;
  // Filter expired before reporting count
  const now = Date.now();
  const liveGlobal = globalTimestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS).length;
  return NextResponse.json({
    service: 'strix-sponsor',
    network: ACTIVE_NETWORK,
    sponsored_methods: Array.from(ALLOWED_METHODS),
    rate_limit: {
      max_per_wallet: RATE_LIMIT_MAX,
      window_hours: RATE_LIMIT_WINDOW_MS / (60 * 60 * 1000),
      global_daily_cap: GLOBAL_DAILY_CAP,
      global_used_today: liveGlobal,
    },
    sponsor_pubkey: sponsorPub,
    sponsor_balance_xlm: balance >= 0 ? balance : null,
    sponsor_threshold_xlm: MIN_SPONSOR_BALANCE_XLM,
  });
}
