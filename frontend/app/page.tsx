'use client';

import Link from 'next/link';
import { useVault } from '@/hooks/useVault';
import { useOptions } from '@/hooks/useOptions';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { formatUsdcDollar, formatUsdc, formatExpiry, formatPercent } from '@/lib/utils';
import { ACTIVE_NETWORK } from '@/lib/constants';

const NETWORK_LABEL = ACTIVE_NETWORK === 'mainnet' ? 'Mainnet' : 'Testnet';

function getNextFriday(): number {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntilFri = ((5 - day + 7) % 7) || 7;
  const fri = new Date(now);
  fri.setUTCDate(now.getUTCDate() + daysUntilFri);
  fri.setUTCHours(16, 0, 0, 0);
  return Math.floor(fri.getTime() / 1000);
}

export default function Dashboard() {
  const { wallet }                               = useWallet();
  const { vaultInfo, loading: vaultLoading }     = useVault(wallet.address);
  const { strikes, spotPrice }                   = useOptions();

  const expiry = getNextFriday();

  const utilizationRate =
    vaultInfo && vaultInfo.tvl > 0n
      ? Number(vaultInfo.locked * 10000n / vaultInfo.tvl) / 100
      : 0;

  const previewStrikes = [...strikes]
    .sort((a, b) => {
      const da = a.strike > spotPrice ? a.strike - spotPrice : spotPrice - a.strike;
      const db = b.strike > spotPrice ? b.strike - spotPrice : spotPrice - b.strike;
      return Number(da - db);
    })
    .slice(0, 5);

  return (
    <div className="space-y-12">

      {/* ══════════════════════════════════════════════════
          HERO
          ══════════════════════════════════════════════════ */}
      <section className="animate-enter relative">
        {/* Large decorative star — top right */}
        <div className="pointer-events-none absolute -top-4 right-0 opacity-[0.07]" aria-hidden>
          <SparkSvg size={160} />
        </div>

        <p className="label mb-4 text-white/30">
          First Options Protocol on Stellar · {NETWORK_LABEL}
        </p>

        <h1 className="font-display leading-[0.92] tracking-[-0.04em] text-white mb-6">
          <span className="block text-[clamp(44px,8vw,72px)] font-bold">Trade XLM</span>
          <span className="block text-[clamp(44px,8vw,72px)] font-light text-white/30">Options.</span>
        </h1>

        <p className="text-[13px] text-white/45 max-w-sm leading-relaxed mb-8 font-sans">
          European-style. Black-Scholes priced. Cash-settled in USDC every Friday at 16:00 UTC.
        </p>

        <div className="flex items-center gap-3">
          <Link href="/options">
            <Button size="lg">Trade Now</Button>
          </Link>
          <Link href="/vault">
            <Button size="lg" variant="outline">Add Liquidity</Button>
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          STATS
          ══════════════════════════════════════════════════ */}
      <section className="animate-enter delay-100">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

          {/* TVL — hero stat */}
          <div className="glass-card px-6 py-6 relative overflow-hidden">
            {/* Soft top glow */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <span className="label">Vault TVL</span>
            <div className="mt-3">
              {vaultLoading || !vaultInfo ? (
                <span className="skeleton h-10 w-32" />
              ) : (
                <span className="data-val text-[clamp(28px,4vw,38px)] text-white tabular">
                  {formatUsdcDollar(vaultInfo.tvl, 0)}
                </span>
              )}
            </div>
            {vaultInfo && (
              <div className="mt-4">
                <div className="util-track w-full">
                  <div className="util-fill" style={{ width: `${Math.min(utilizationRate, 100)}%` }} />
                </div>
                <p className="text-[10px] text-white/25 mt-1.5 font-data tabular">
                  {formatPercent(utilizationRate, 1)} utilized
                </p>
              </div>
            )}
          </div>

          {/* Available capital */}
          <div className="glass-card px-5 py-6">
            <span className="label">Available</span>
            <div className="mt-3">
              {vaultLoading || !vaultInfo ? (
                <span className="skeleton h-7 w-24" />
              ) : (
                <span className="data-val text-[22px] text-white tabular">
                  {formatUsdcDollar(vaultInfo.available, 0)}
                </span>
              )}
            </div>
            <p className="text-[10px] text-white/25 mt-1.5 font-sans">for new positions</p>
          </div>

          {/* Next expiry */}
          <div className="glass-card px-5 py-6">
            <span className="label">Next Expiry</span>
            <div className="mt-3">
              <span className="data-val text-[22px] text-white tabular">
                {new Date(expiry * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <p className="text-[10px] text-white/25 mt-1.5 font-sans">Friday · 16:00 UTC</p>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          OPTIONS CHAIN PREVIEW
          ══════════════════════════════════════════════════ */}
      <section className="animate-enter delay-200">

        <div className="flex items-baseline justify-between mb-5">
          <div>
            <span className="label mb-1.5">Live Options Chain</span>
            <p className="text-[11px] text-white/25 font-sans">
              Expiry {formatExpiry(expiry)} · {spotPrice > 0n ? `Spot $${formatUsdc(spotPrice, 4)}` : 'Loading spot…'}
            </p>
          </div>
          <Link
            href="/options"
            className="text-[10px] text-white/25 hover:text-white/60 font-sans tracking-wider uppercase transition-colors flex items-center gap-1"
          >
            Full chain →
          </Link>
        </div>

        <div className="glass-card overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[auto_1fr_1fr] sm:grid-cols-[auto_1fr_36px_1fr] border-b border-white/[0.06] bg-white/[0.02]">
            <div className="px-4 py-2.5 w-[110px]"><span className="label">Strike</span></div>
            <div className="px-4 py-2.5 text-right"><span className="label text-mint/60">Call</span></div>
            <div className="hidden sm:block px-2 py-2.5 text-center"><span className="label text-white/15">·</span></div>
            <div className="px-4 py-2.5 text-right"><span className="label text-rust/60">Put</span></div>
          </div>

          {previewStrikes.length > 0 ? previewStrikes.map((row) => {
            const isAtm = spotPrice > 0n &&
              Number(row.strike > spotPrice ? row.strike - spotPrice : spotPrice - row.strike) / Number(spotPrice) < 0.005;
            const callItm = row.strike < spotPrice;
            const putItm  = row.strike > spotPrice;

            return (
              <div
                key={row.strike.toString()}
                className={`row-hover grid grid-cols-[auto_1fr_1fr] sm:grid-cols-[auto_1fr_36px_1fr] border-b border-white/[0.05] last:border-b-0 ${isAtm ? 'bg-white/[0.02]' : ''}`}
              >
                <div className="px-4 py-3 w-[110px] flex items-center gap-2">
                  <span className={`font-data text-[12px] tabular font-semibold ${isAtm ? 'text-white' : 'text-white/70'}`}>
                    ${formatUsdc(row.strike, 4)}
                  </span>
                  {isAtm && <span className="badge badge-atm">ATM</span>}
                </div>
                <div className="px-4 py-3 text-right">
                  <span className={`font-data text-[12px] tabular ${callItm ? 'text-mint' : 'text-white/30'}`}>
                    {row.callPremium > 0n
                      ? `$${formatUsdc(row.callPremium, 4)}`
                      : <span className="skeleton h-3 w-14 inline-block" />
                    }
                  </span>
                </div>
                <div className="hidden sm:flex items-center justify-center px-2 py-3">
                  <span className="text-white/15 text-[11px]">·</span>
                </div>
                <div className="px-4 py-3 text-right">
                  <span className={`font-data text-[12px] tabular ${putItm ? 'text-rust' : 'text-white/30'}`}>
                    {row.putPremium > 0n
                      ? `$${formatUsdc(row.putPremium, 4)}`
                      : <span className="skeleton h-3 w-14 inline-block" />
                    }
                  </span>
                </div>
              </div>
            );
          }) : (
            <div className="px-4 py-8 flex flex-col items-center gap-2">
              <span className="skeleton h-3.5 w-40 block" />
              <span className="skeleton h-3 w-28 block" />
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          PROTOCOL FLOW
          ══════════════════════════════════════════════════ */}
      <section className="animate-enter delay-250">
        <span className="label mb-6 block">How It Works</span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              n: '01',
              title: 'LPs Fund the Vault',
              body: 'Deposit USDC to underwrite options. Earn premium income when options expire worthless.',
            },
            {
              n: '02',
              title: 'Traders Buy Options',
              body: 'Buy European calls or puts at any listed strike. Black-Scholes pricing with live oracle data.',
            },
            {
              n: '03',
              title: 'Friday Settlement',
              body: 'Options settle at 16:00 UTC each Friday. ITM holders claim USDC payouts automatically.',
            },
          ].map((step) => (
            <div key={step.n} className="glass-card px-6 py-6">
              <span className="flow-step-num block mb-4">{step.n}</span>
              <h3 className="font-display text-[14px] font-bold text-white tracking-tight mb-2">{step.title}</h3>
              <p className="text-[11px] text-white/30 leading-relaxed font-sans">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          PROTOCOL PARAMS — reference grid
          ══════════════════════════════════════════════════ */}
      <section className="animate-enter delay-300">
        <span className="label mb-5 block">Protocol Parameters</span>
        <div className="glass-card overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4">
            {[
              ['Underlying',   'XLM / USDC'],
              ['Style',        'European'],
              ['Settlement',   'Cash (USDC)'],
              ['Implied Vol',  '80%'],
              ['Cycle',        'Weekly'],
              ['Strike Range', '±5–20%'],
              ['Oracle',       'Reflector'],
              ['Network',      NETWORK_LABEL],
            ].map(([k, v], i) => (
              <div key={k} className={`px-4 py-3.5 ${i < 4 ? 'border-b border-white/[0.05]' : ''} ${i % 4 !== 3 ? 'border-r border-white/[0.05]' : ''}`}>
                <span className="label mb-1">{k}</span>
                <p className="font-data text-[11px] text-white/50 tabular">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}

function SparkSvg({ size = 100 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      <path
        d="M50 0 L53.5 46.5 L100 50 L53.5 53.5 L50 100 L46.5 53.5 L0 50 L46.5 46.5 Z"
        fill="white"
      />
    </svg>
  );
}
