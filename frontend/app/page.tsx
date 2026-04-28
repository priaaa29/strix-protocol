'use client';

import Link from 'next/link';
import { useVault } from '@/hooks/useVault';
import { useOptions } from '@/hooks/useOptions';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { formatUsdcDollar, formatUsdc, formatExpiry, formatPercent } from '@/lib/utils';

function getNextFriday(): number {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntilFri = ((5 - day + 7) % 7) || 7;
  const fri = new Date(now);
  fri.setUTCDate(now.getUTCDate() + daysUntilFri);
  fri.setUTCHours(16, 0, 0, 0);
  return Math.floor(fri.getTime() / 1000);
}

const PARAMS = [
  { label: 'Underlying',  value: 'XLM / USDC' },
  { label: 'Style',       value: 'European'   },
  { label: 'Settlement',  value: 'Cash (USDC)' },
  { label: 'Impl. Vol',   value: '80%'        },
  { label: 'Cycle',       value: 'Weekly'     },
  { label: 'Strike Range',value: '±5–20%'    },
  { label: 'Oracle',      value: 'MockOracle' },
  { label: 'Network',     value: 'Testnet'    },
] as const;

export default function Dashboard() {
  const { wallet } = useWallet();
  const { vaultInfo, loading: vaultLoading } = useVault(wallet.address);
  const { strikes, spotPrice } = useOptions();

  const now = Math.floor(Date.now() / 1000);
  const expiry = getNextFriday();

  const utilizationRate =
    vaultInfo && vaultInfo.tvl > 0n
      ? Number(vaultInfo.locked * 10000n / vaultInfo.tvl) / 100
      : 0;

  // Take the 3 ATM-nearest strikes for the preview
  const previewStrikes = [...strikes]
    .sort((a, b) => {
      const da = a.strike > spotPrice ? a.strike - spotPrice : spotPrice - a.strike;
      const db = b.strike > spotPrice ? b.strike - spotPrice : spotPrice - b.strike;
      return Number(da - db);
    })
    .slice(0, 5);

  return (
    <div className="space-y-8">

      {/* ── Page header ───────────────────────────────────── */}
      <div className="animate-enter">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="label text-gold">First Options Protocol on Stellar</span>
            <h1 className="font-display text-[28px] sm:text-[36px] font-bold tracking-tight text-ink mt-2 leading-[1.1]">
              Trade XLM Options.<br />
              <span className="text-ink-2">Earn Yield. On-chain.</span>
            </h1>
          </div>
          <div className="flex gap-2 mt-1">
            <Link href="/options"><Button size="md">Trade Now</Button></Link>
            <Link href="/vault"><Button size="md" variant="outline">Add Liquidity</Button></Link>
          </div>
        </div>
      </div>

      {/* ── Key stats row ──────────────────────────────────── */}
      <div className="animate-enter delay-100">
        <div className="grid grid-cols-2 sm:grid-cols-4 border border-surface-border rounded-sm overflow-hidden">
          {[
            {
              label: 'Vault TVL',
              value: vaultLoading || !vaultInfo
                ? null
                : formatUsdcDollar(vaultInfo.tvl, 0),
              sub: vaultInfo ? `${formatPercent(utilizationRate, 1)} locked` : '',
            },
            {
              label: 'Available Capital',
              value: vaultLoading || !vaultInfo
                ? null
                : formatUsdcDollar(vaultInfo.available, 0),
              sub: 'for new positions',
            },
            {
              label: 'Spot Price',
              value: spotPrice > 0n ? `$${formatUsdc(spotPrice, 4)}` : null,
              sub: 'XLM / USDC',
            },
            {
              label: 'Next Expiry',
              value: new Date(expiry * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              sub: 'Fri 16:00 UTC',
            },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={[
                "p-4 sm:p-5 bg-surface-raised border-surface-border",
                i < 3 ? "border-r" : "",
                i < 2 ? "border-b sm:border-b-0" : "",
              ].join(' ')}
            >
              <span className="label">{stat.label}</span>
              <div className="mt-2">
                {stat.value !== null ? (
                  <span className="data-val text-[18px] sm:text-[22px] text-ink tabular">
                    {stat.value}
                  </span>
                ) : (
                  <span className="skeleton h-6 w-24 mt-1" />
                )}
              </div>
              {stat.sub && (
                <p className="text-[11px] text-ink-3 mt-1">{stat.sub}</p>
              )}
            </div>
          ))}
        </div>

        {/* Utilization bar */}
        {vaultInfo && (
          <div className="util-track rounded-none mt-0 border-x border-b border-surface-border rounded-b-sm overflow-hidden">
            <div
              className="util-fill"
              style={{ width: `${Math.min(utilizationRate, 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Options chain preview ──────────────────────────── */}
      <div className="animate-enter delay-200">
        <div className="flex items-center justify-between mb-3">
          <span className="label">Live Options Chain</span>
          <Link href="/options" className="text-[11px] text-gold hover:text-gold-bright transition-colors duration-150 uppercase tracking-wider">
            Full chain →
          </Link>
        </div>

        <div className="border border-surface-border rounded-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_auto_1fr] bg-surface-over border-b border-surface-border px-4 py-2">
            {['Strike', 'Call', '', 'Put'].map((h, i) => (
              <span key={i} className={`label ${i === 1 ? 'text-mint' : i === 3 ? 'text-rust' : ''} ${i >= 1 ? 'text-right' : ''}`}>
                {h}
              </span>
            ))}
          </div>

          {previewStrikes.length > 0 ? previewStrikes.map((row) => {
            const isAtm = row.strike === spotPrice ||
              (spotPrice > 0n && Number(row.strike > spotPrice ? row.strike - spotPrice : spotPrice - row.strike) / Number(spotPrice) < 0.005);
            const callItm = row.strike < spotPrice;
            const putItm  = row.strike > spotPrice;

            return (
              <div
                key={row.strike.toString()}
                className={`row-hover grid grid-cols-[1fr_1fr_auto_1fr] px-4 py-2.5 border-b border-surface-border last:border-b-0 ${isAtm ? 'bg-gold/[0.04]' : ''}`}
              >
                <span className={`font-mono text-sm tabular font-medium ${isAtm ? 'text-gold' : 'text-ink'}`}>
                  ${formatUsdc(row.strike, 4)}
                  {isAtm && <span className="ml-1.5 text-[9px] text-gold uppercase tracking-widest">atm</span>}
                </span>
                <span className={`font-mono text-sm tabular text-right ${callItm ? 'text-mint' : 'text-ink-2'}`}>
                  {row.callPremium > 0n ? `$${formatUsdc(row.callPremium, 4)}` : <span className="skeleton h-3.5 w-12 inline-block" />}
                </span>
                <span className="px-3 text-ink-3 text-sm">·</span>
                <span className={`font-mono text-sm tabular text-right ${putItm ? 'text-rust' : 'text-ink-2'}`}>
                  {row.putPremium > 0n ? `$${formatUsdc(row.putPremium, 4)}` : <span className="skeleton h-3.5 w-12 inline-block" />}
                </span>
              </div>
            );
          }) : (
            <div className="px-4 py-6 text-center">
              <span className="skeleton h-4 w-32 mx-auto block mb-2" />
              <span className="skeleton h-4 w-24 mx-auto block" />
            </div>
          )}
        </div>
      </div>

      {/* ── How it works ──────────────────────────────────── */}
      <div className="animate-enter delay-250">
        <span className="label mb-4 block">Protocol Flow</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-surface-border border border-surface-border rounded-sm overflow-hidden">
          {[
            {
              n: '01',
              title: 'LPs Deposit USDC',
              body: 'Liquidity providers fund the underwriting vault. They earn option premiums when buyers pay to open positions.',
            },
            {
              n: '02',
              title: 'Traders Buy Options',
              body: 'Buy European calls or puts on XLM at any listed strike. Premiums computed via Black-Scholes with live oracle pricing.',
            },
            {
              n: '03',
              title: 'Friday Settlement',
              body: 'Options settle weekly at 16:00 UTC. ITM holders claim USDC payouts. OTM premiums accrue to vault share price.',
            },
          ].map((step) => (
            <div key={step.n} className="bg-surface-raised p-5 space-y-2">
              <span className="data-val text-[28px] text-surface-border tabular select-none">
                {step.n}
              </span>
              <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-ink">
                {step.title}
              </h3>
              <p className="text-[12px] text-ink-2 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Protocol params ───────────────────────────────── */}
      <div className="animate-enter delay-300">
        <span className="label mb-3 block">Protocol Parameters</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-surface-border border border-surface-border rounded-sm overflow-hidden">
          {PARAMS.map((p) => (
            <div key={p.label} className="bg-surface-raised px-4 py-3">
              <span className="label text-ink-3">{p.label}</span>
              <p className="text-sm text-ink font-mono mt-1 tabular">{p.value}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
