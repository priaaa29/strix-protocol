'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProtocolMetrics, type ProtocolMetrics } from '@/lib/soroban';
import { COMMUNITY_ACCOUNTS } from '@/lib/community-accounts';
import { CONTRACT_IDS, ACTIVE_NETWORK } from '@/lib/constants';
import { formatUsdc, formatUsdcDollar, formatSharePrice, formatPercent } from '@/lib/utils';

const NETWORK_LABEL = ACTIVE_NETWORK === 'mainnet' ? 'Mainnet' : 'Testnet';
const EXPLORER_BASE = ACTIVE_NETWORK === 'mainnet'
  ? 'https://stellar.expert/explorer/public'
  : 'https://stellar.expert/explorer/testnet';

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<ProtocolMetrics | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const m = await getProtocolMetrics();
        if (cancelled) return;
        setMetrics(m);
        setUpdated(new Date());
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const utilizationBps = metrics && metrics.tvl > 0n
    ? Number((metrics.locked * 10000n) / metrics.tvl)
    : 0;

  return (
    <div className="space-y-10 animate-enter">

      {/* ─── Header ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-mint/60" />
          <span className="label text-white/22 tracking-[0.14em]">Live · Strix Protocol · {NETWORK_LABEL}</span>
        </div>
        <h1 className="font-display leading-[0.9] tracking-[-0.03em] text-white mb-3">
          <span className="block text-[clamp(32px,5vw,52px)] font-bold">Protocol Metrics</span>
        </h1>
        <p className="text-[12px] text-white/40 font-sans leading-relaxed max-w-md">
          Real-time on-chain state pulled directly from Soroban contracts. Auto-refreshes every 30 seconds.
        </p>
      </section>

      {error && !metrics && (
        <div className="border border-rust/25 bg-rust/[0.06] rounded-2xl p-5">
          <p className="text-sm text-rust">Couldn't load metrics: {error}</p>
        </div>
      )}

      {/* ─── Headline KPIs ──────────────────────────────────── */}
      <section className="grid grid-cols-2 sm:grid-cols-4 divide-y divide-x divide-white/[0.06] border border-white/[0.06] rounded-2xl overflow-hidden">
        <Kpi label="Total Value Locked" value={metrics ? formatUsdcDollar(metrics.tvl, 0) : null} sub="USDC underwriting capacity" />
        <Kpi label="Capital Utilization" value={metrics ? formatPercent(utilizationBps / 100, 2) : null} sub="locked vs. available" />
        <Kpi label="Positions Opened" value={metrics ? metrics.totalPositions.toString() : null} sub="lifetime cumulative" />
        <Kpi label="Onboarded Wallets" value={`${COMMUNITY_ACCOUNTS.length}`} sub="6 real testers + 24 demo seeds" />
      </section>

      {/* ─── Vault breakdown ──────────────────────────────── */}
      <section>
        <span className="label mb-4 block">Vault State</span>
        <div className="glass-card overflow-hidden">
          <Row label="TVL"           value={metrics ? `$${formatUsdc(metrics.tvl, 2)}` : null} />
          <Row label="Locked"        value={metrics ? `$${formatUsdc(metrics.locked, 2)}` : null} />
          <Row label="Available"     value={metrics ? `$${formatUsdc(metrics.available, 2)}` : null} />
          <Row label="Share Price"   value={metrics ? `$${formatSharePrice(metrics.sharePrice)}` : null} />
          <Row label="Total Shares"  value={metrics ? formatUsdc(metrics.totalShares, 4) : null} />
        </div>
      </section>

      {/* ─── Market state ──────────────────────────────────── */}
      <section>
        <span className="label mb-4 block">Market State</span>
        <div className="glass-card overflow-hidden">
          <Row label="XLM Spot Price"   value={metrics && metrics.spotPrice > 0n ? `$${formatUsdc(metrics.spotPrice, 4)}` : '—'} />
          <Row label="Implied Volatility" value="80%" sub="admin-configurable" />
          <Row label="Spread"             value="1%" sub="admin-configurable" />
          <Row label="Market Status"      value={metrics ? (metrics.paused ? 'Paused' : 'Active') : null} valueClass={metrics?.paused ? 'text-rust' : 'text-mint'} />
        </div>
      </section>

      {/* ─── Deployed contracts ────────────────────────────── */}
      <section>
        <span className="label mb-4 block">Deployed Contracts</span>
        <div className="glass-card overflow-hidden">
          <ContractRow label="OptionMarket"  addr={CONTRACT_IDS.optionMarket} />
          <ContractRow label="UnderwritingVault" addr={CONTRACT_IDS.vault} />
          <ContractRow label="PricingEngine" addr={CONTRACT_IDS.pricingEngine} />
          <ContractRow label="Reflector Oracle" addr={metrics?.oracleAddress ?? CONTRACT_IDS.oracle} />
          <ContractRow label="USDC SAC"      addr={CONTRACT_IDS.usdcToken} />
        </div>
      </section>

      {/* ─── Indexer health ────────────────────────────────── */}
      <section>
        <span className="label mb-4 block">Indexer & API Status</span>
        <div className="glass-card overflow-hidden">
          <Row label="Backend indexer"   value="SQLite + 30s poll" sub="see docs/data-indexing.md" />
          <Row label="Soroban RPC"       value="testnet.stellar.org" valueClass="text-mint" />
          <Row label="Oracle"            value="Reflector (14-decimal)" sub="updates every ~5 minutes" />
          <Row label="Settlement keeper" value="permissionless" sub="any user can call settle()" />
        </div>
        <div className="mt-4 flex items-center gap-3 text-[11px] text-white/30 font-sans">
          <span>Architecture →</span>
          <Link href="/explorer" className="text-gold/70 hover:text-gold transition-colors">Community Wallets</Link>
          <span className="text-white/15">·</span>
          <a
            href={`${EXPLORER_BASE}/contract/${CONTRACT_IDS.optionMarket}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold/70 hover:text-gold transition-colors"
          >
            OptionMarket on Stellar Expert ↗
          </a>
        </div>
      </section>

      {updated && (
        <div className="text-[10px] text-white/22 font-mono uppercase tracking-wider">
          Last updated · {updated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

/* ─── Components ──────────────────────────────────────────── */

function Kpi({ label, value, sub }: { label: string; value: string | null; sub: string }) {
  return (
    <div className="px-6 py-7 bg-[hsl(0,0%,3%)] hover:bg-white/[0.02] transition-colors">
      <span className="label mb-3 block">{label}</span>
      <div className="font-display text-[clamp(22px,3.5vw,32px)] font-bold text-white leading-none tracking-tight tabular">
        {value ?? <span className="skeleton h-8 w-24 inline-block" />}
      </div>
      <p className="text-[10px] text-white/28 mt-2 font-sans">{sub}</p>
    </div>
  );
}

function Row({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string | null;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center px-5 py-3.5 border-b border-white/[0.05] last:border-b-0">
      <div>
        <span className="label">{label}</span>
        {sub && <p className="text-[10px] text-white/22 mt-0.5 font-sans">{sub}</p>}
      </div>
      <span className={`font-data text-[13px] tabular ${valueClass ?? 'text-white/75'}`}>
        {value ?? <span className="skeleton h-4 w-20 inline-block" />}
      </span>
    </div>
  );
}

function ContractRow({ label, addr }: { label: string; addr: string }) {
  const short = addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '—';
  return (
    <div className="grid grid-cols-[1fr_auto] items-center px-5 py-3.5 border-b border-white/[0.05] last:border-b-0">
      <span className="label">{label}</span>
      <a
        href={`${EXPLORER_BASE}/contract/${addr}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[11px] text-gold/70 hover:text-gold transition-colors tabular"
      >
        {short} ↗
      </a>
    </div>
  );
}
