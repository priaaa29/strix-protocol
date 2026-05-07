'use client';

import Link from 'next/link';
import { useVault } from '@/hooks/useVault';
import { useOptions } from '@/hooks/useOptions';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Tilt } from '@/components/ui/Tilt';
import { GlowStar } from '@/components/ui/GlowStar';
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

type StrikeRow = { strike: bigint; callPremium: bigint; putPremium: bigint };

export default function Dashboard() {
  const { wallet }                           = useWallet();
  const { vaultInfo, loading: vaultLoading } = useVault(wallet.address);
  const { strikes, spotPrice }               = useOptions();

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
    <div className="space-y-20">

      {/* ══════════════════════════════════════════════════
          HERO
          ══════════════════════════════════════════════════ */}
      <section className="animate-enter relative min-h-[500px] lg:min-h-[560px] flex flex-col justify-center">

        {/* ── Star light cast — screen blend illuminates nearby text ── */}
        {/* This is the "light falling on content" effect: a large radial gradient
            with mix-blend-mode:screen brightens the dark background wherever the
            star's light would reach, making nearby text appear lit from the right. */}
        <div
          className="pointer-events-none select-none absolute hidden lg:block"
          style={{
            right: '-120px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '920px',
            height: '920px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, ' +
              'rgba(255,255,255,0.28) 0%, ' +
              'rgba(255,255,255,0.16) 8%, ' +
              'rgba(255,255,255,0.07) 22%, ' +
              'rgba(255,255,255,0.025) 40%, ' +
              'rgba(255,255,255,0.008) 55%, ' +
              'transparent 70%)',
            mixBlendMode: 'screen',
            zIndex: 2,
          }}
          aria-hidden
        />

        {/* Chrome glow star — primary hero 3D element */}
        <div className="pointer-events-none select-none absolute right-8 top-1/2 -translate-y-1/2 w-[520px] h-[520px] hidden lg:block" style={{ zIndex: 3 }}>
          <GlowStar className="w-full h-full opacity-90" />
        </div>

        {/* Mobile decorative star fallback */}
        <div className="lg:hidden pointer-events-none select-none absolute -top-8 right-0 star-pulse" aria-hidden>
          <div className="star-rotate opacity-[0.12]"><SparkSvg size={110} /></div>
        </div>

        {/* Small accent stars */}
        <div className="pointer-events-none select-none" aria-hidden>
          <div className="absolute top-1/3 -left-4 opacity-[0.05]">
            <div className="star-rotate-reverse"><SparkSvg size={44} /></div>
          </div>
          <div className="absolute bottom-8 right-[42%] opacity-[0.04]">
            <div className="star-rotate-slow"><SparkSvg size={26} /></div>
          </div>
        </div>

        {/* Text */}
        <div className="relative z-10 max-w-[500px]">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1.5 h-1.5 rounded-full bg-white/25" />
            <p className="label text-white/25 tracking-[0.16em]">
              First Options Protocol on Stellar · {NETWORK_LABEL}
            </p>
          </div>

          <h1 className="font-display leading-[0.87] tracking-[-0.04em] text-white mb-7">
            <span className="block text-[clamp(50px,8.5vw,80px)] font-bold">Trade XLM</span>
            <span className="block text-[clamp(50px,8.5vw,80px)] font-bold">Options</span>
            <span className="block text-[clamp(50px,8.5vw,80px)] font-light text-white/22">On-Chain.</span>
          </h1>

          <p className="text-[13px] text-white/40 max-w-[360px] leading-relaxed mb-9 font-sans">
            European-style. Black-Scholes priced. Cash-settled in USDC every Friday at 16:00 UTC.
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/options">
              <Button size="lg">Trade Now</Button>
            </Link>
            <Link href="/vault">
              <Button size="lg" variant="outline">Add Liquidity →</Button>
            </Link>
          </div>
        </div>

        {/* Floating product mockup — desktop only */}
        <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-[52%]" aria-hidden>
          <div className="card-float">
            <ChainMockup spotPrice={spotPrice} rows={previewStrikes} />
          </div>
        </div>

      </section>

      {/* ══════════════════════════════════════════════════
          TRUST BAR
          ══════════════════════════════════════════════════ */}
      <section className="animate-enter delay-100">
        <div className="flex items-center gap-4 mb-5">
          <div className="h-px flex-1 bg-white/[0.05]" />
          <span className="label text-white/18">Built on</span>
          <div className="h-px flex-1 bg-white/[0.05]" />
        </div>
        <div className="flex items-center justify-center gap-10 flex-wrap">
          {['Stellar', 'Soroban', 'Reflector Oracle', 'Circle USDC'].map(name => (
            <span key={name} className="font-display text-[12px] font-semibold text-white/18 tracking-tight">
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          BIG STATS STRIP
          ══════════════════════════════════════════════════ */}
      <section className="animate-enter-3d delay-150">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06] border border-white/[0.06] rounded-2xl overflow-hidden">
          {[
            {
              val: vaultLoading || !vaultInfo ? null : formatUsdcDollar(vaultInfo.tvl, 0),
              label: 'Total Value Locked',
              sub: 'USDC underwriting capacity',
            },
            { val: '80%',    label: 'Implied Volatility', sub: 'Black-Scholes model input' },
            { val: 'Weekly', label: 'Settlement Cycle',   sub: 'Every Friday · 16:00 UTC' },
          ].map(({ val, label, sub }) => (
            <div key={label} className="px-7 py-8 bg-[hsl(0,0%,3%)] group hover:bg-white/[0.02] transition-colors">
              <div className="font-display text-[clamp(28px,4.5vw,44px)] font-bold text-white leading-none tracking-tight mb-2">
                {val ?? <span className="skeleton h-10 w-28 inline-block" />}
              </div>
              <div className="font-sans text-[12px] font-semibold text-white/55 mb-1">{label}</div>
              <div className="font-sans text-[11px] text-white/22">{sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FEATURE BENTO
          ══════════════════════════════════════════════════ */}
      <section className="animate-enter delay-200">
        <div className="mb-9">
          <span className="label mb-3">Features</span>
          <h2 className="font-display text-[clamp(26px,4vw,38px)] font-bold text-white leading-[1.05] tracking-[-0.03em]">
            Options Platform Built
            <br />
            <span className="font-light text-white/28">for the New Frontier</span>
          </h2>
        </div>

        {/* 3-col row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <Tilt>
            <div className="glass-card px-6 py-7 h-full">
              <div className="mb-5 w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                <IconPricing className="w-[18px] h-[18px] text-white/50" />
              </div>
              <h3 className="font-display text-[15px] font-bold text-white mb-2 tracking-tight">Live BS Pricing</h3>
              <p className="text-[12px] text-white/32 leading-relaxed font-sans">
                Every premium computed in real-time using Black-Scholes with a live Reflector oracle feed.
              </p>
            </div>
          </Tilt>

          <Tilt>
            <div className="glass-card px-6 py-7 h-full">
              <div className="mb-5 w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                <IconVaultFeature className="w-[18px] h-[18px] text-white/50" />
              </div>
              <h3 className="font-display text-[15px] font-bold text-white mb-2 tracking-tight">LP Vault Yield</h3>
              <p className="text-[12px] text-white/32 leading-relaxed font-sans">
                Deposit USDC to underwrite options. Earn premium income when contracts expire out-of-the-money.
              </p>
            </div>
          </Tilt>

          <Tilt>
            <div className="glass-card px-6 py-7 h-full">
              <div className="mb-5 w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                <IconSettlement className="w-[18px] h-[18px] text-white/50" />
              </div>
              <h3 className="font-display text-[15px] font-bold text-white mb-2 tracking-tight">Auto Settlement</h3>
              <p className="text-[12px] text-white/32 leading-relaxed font-sans">
                ITM options settle automatically on-chain. USDC payouts hit your wallet without lifting a finger.
              </p>
            </div>
          </Tilt>
        </div>

        {/* Wide feature card */}
        <Tilt strength={4}>
          <div className="glass-card px-7 py-6 flex flex-col sm:flex-row items-start sm:items-center gap-8">
            <div className="flex-1 min-w-0">
              <span className="label mb-2">European-style · Cash-settled</span>
              <h3 className="font-display text-[18px] font-bold text-white mb-2 tracking-tight">
                No early exercise. No delivery risk.
              </h3>
              <p className="text-[12px] text-white/32 font-sans leading-relaxed">
                Options settle only at expiry — no complexity, no surprises. Always cash-settled in USDC on Soroban.
              </p>
            </div>
            <div className="flex items-center gap-8 shrink-0 flex-wrap">
              {[
                ['European', 'Style'],
                ['USDC',     'Settlement'],
                ['Soroban',  'Smart Contract'],
              ].map(([v, l]) => (
                <div key={l} className="text-center">
                  <div className="font-display text-[14px] font-bold text-white">{v}</div>
                  <div className="font-sans text-[10px] text-white/28 mt-0.5">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </Tilt>
      </section>

      {/* ══════════════════════════════════════════════════
          LIVE OPTIONS CHAIN PREVIEW
          ══════════════════════════════════════════════════ */}
      <section className="animate-enter delay-250">
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <span className="label mb-1.5">Live Options Chain</span>
            <p className="text-[11px] text-white/25 font-sans">
              Expiry {formatExpiry(expiry)} · {spotPrice > 0n ? `Spot $${formatUsdc(spotPrice, 4)}` : 'Loading spot…'}
            </p>
          </div>
          <Link
            href="/options"
            className="text-[10px] text-white/25 hover:text-white/60 font-sans tracking-wider uppercase transition-colors"
          >
            Full chain →
          </Link>
        </div>

        <div className="glass-card overflow-hidden">
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
                    {row.callPremium > 0n ? `$${formatUsdc(row.callPremium, 4)}` : <span className="skeleton h-3 w-14 inline-block" />}
                  </span>
                </div>
                <div className="hidden sm:flex items-center justify-center px-2 py-3">
                  <span className="text-white/15 text-[11px]">·</span>
                </div>
                <div className="px-4 py-3 text-right">
                  <span className={`font-data text-[12px] tabular ${putItm ? 'text-rust' : 'text-white/30'}`}>
                    {row.putPremium > 0n ? `$${formatUsdc(row.putPremium, 4)}` : <span className="skeleton h-3 w-14 inline-block" />}
                  </span>
                </div>
              </div>
            );
          }) : (
            <div className="px-4 py-10 flex flex-col items-center gap-2">
              <span className="skeleton h-3.5 w-40 block" />
              <span className="skeleton h-3 w-28 block" />
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          HOW IT WORKS
          ══════════════════════════════════════════════════ */}
      <section className="animate-enter delay-300">
        <div className="flex items-baseline justify-between mb-6">
          <span className="label">How It Works</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { n: '01', title: 'LPs Fund the Vault',   body: 'Deposit USDC to underwrite options. Earn premium income when options expire worthless.' },
            { n: '02', title: 'Traders Buy Options',  body: 'Buy European calls or puts at any listed strike. Black-Scholes pricing with live oracle data.' },
            { n: '03', title: 'Friday Settlement',    body: 'Options settle at 16:00 UTC each Friday. ITM holders claim USDC payouts automatically.' },
          ].map(step => (
            <Tilt key={step.n} strength={5}>
              <div className="glass-card px-6 py-6 h-full">
                <span className="flow-step-num block mb-4">{step.n}</span>
                <h3 className="font-display text-[14px] font-bold text-white tracking-tight mb-2">{step.title}</h3>
                <p className="text-[11px] text-white/30 leading-relaxed font-sans">{step.body}</p>
              </div>
            </Tilt>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          PROTOCOL PARAMS
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

      {/* ══════════════════════════════════════════════════
          CTA BANNER
          ══════════════════════════════════════════════════ */}
      <section className="animate-enter delay-400">
        <div className="glass-card px-8 py-12 text-center relative overflow-hidden">
          {/* Glow star behind CTA */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.18]" aria-hidden>
            <GlowStar className="w-[420px] h-[420px]" />
          </div>
          {/* Radial center glow */}
          <div className="pointer-events-none absolute inset-0" aria-hidden
            style={{ background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.04) 0%, transparent 65%)' }} />

          <div className="relative z-10">
            <span className="label mb-4">Ready to trade?</span>
            <h2 className="font-display text-[clamp(24px,4vw,40px)] font-bold text-white mb-3 tracking-[-0.03em]">
              Start trading XLM options today.
            </h2>
            <p className="text-[13px] text-white/35 font-sans mb-8 max-w-sm mx-auto leading-relaxed">
              {ACTIVE_NETWORK === 'mainnet'
                ? 'Live on Stellar mainnet. Trade real options, earn real yield.'
                : 'Testnet is live. Explore the full protocol — no real funds required.'}
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href="/options"><Button size="lg">Trade Now</Button></Link>
              <Link href="/vault"><Button size="lg" variant="outline">Add Liquidity</Button></Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

/* ─── Floating product mockup ───────────────────────────── */

function ChainMockup({ spotPrice, rows }: { spotPrice: bigint; rows: StrikeRow[] }) {
  const priceStr = spotPrice > 0n ? `$${formatUsdc(spotPrice, 4)}` : null;

  return (
    <div className="glass-card overflow-hidden w-[275px] shadow-[0_32px_80px_rgba(0,0,0,0.6)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.07] bg-white/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-display text-[13px] font-bold text-white">XLM / USDC</span>
          {priceStr && <span className="font-data text-[11px] text-white/40">{priceStr}</span>}
        </div>
        <span className="badge badge-live">LIVE</span>
      </div>
      {/* Column headers */}
      <div className="grid grid-cols-3 px-4 py-2 bg-white/[0.015]">
        <span className="label text-[9px]">Strike</span>
        <span className="label text-[9px] text-mint/55 text-right">Call</span>
        <span className="label text-[9px] text-rust/55 text-right">Put</span>
      </div>
      {/* Rows */}
      {rows.length > 0 ? rows.slice(0, 4).map((row) => {
        const isAtm = spotPrice > 0n &&
          Number(row.strike > spotPrice ? row.strike - spotPrice : spotPrice - row.strike) / Number(spotPrice) < 0.008;
        const callItm = row.strike < spotPrice;
        const putItm  = row.strike > spotPrice;
        return (
          <div key={row.strike.toString()} className={`grid grid-cols-3 px-4 py-2.5 border-b border-white/[0.04] last:border-0 ${isAtm ? 'bg-white/[0.025]' : ''}`}>
            <span className={`font-data text-[11px] tabular ${isAtm ? 'text-white font-semibold' : 'text-white/60'}`}>
              ${formatUsdc(row.strike, 4)}
            </span>
            <span className={`font-data text-[11px] tabular text-right ${callItm ? 'text-mint' : 'text-white/28'}`}>
              {row.callPremium > 0n ? `$${formatUsdc(row.callPremium, 4)}` : '—'}
            </span>
            <span className={`font-data text-[11px] tabular text-right ${putItm ? 'text-rust' : 'text-white/28'}`}>
              {row.putPremium > 0n ? `$${formatUsdc(row.putPremium, 4)}` : '—'}
            </span>
          </div>
        );
      }) : [0, 1, 2, 3].map(i => (
        <div key={i} className="grid grid-cols-3 px-4 py-2.5 gap-3 border-b border-white/[0.04] last:border-0">
          <span className="skeleton h-3 w-12 inline-block" />
          <span className="skeleton h-3 w-9 inline-block ml-auto" />
          <span className="skeleton h-3 w-9 inline-block ml-auto" />
        </div>
      ))}
    </div>
  );
}

/* ─── Decorative SVGs ───────────────────────────────────── */

function SparkSvg({ size = 100 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      <path d="M50 0 L53.5 46.5 L100 50 L53.5 53.5 L50 100 L46.5 53.5 L0 50 L46.5 46.5 Z" fill="white" />
    </svg>
  );
}

function IconPricing({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
      <polyline points="1,14 5,8 9,10.5 13,4 17,7" strokeLinejoin="round" strokeLinecap="round" />
      <line x1="1" y1="17" x2="17" y2="17" strokeLinecap="round" />
    </svg>
  );
}

function IconVaultFeature({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1.5" y="3" width="15" height="12" rx="2" />
      <circle cx="9" cy="9" r="2.5" />
      <line x1="11.5" y1="9" x2="15" y2="9" strokeLinecap="round" />
    </svg>
  );
}

function IconSettlement({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="3" width="14" height="13" rx="1.5" />
      <line x1="6" y1="1.5" x2="6" y2="5" strokeLinecap="round" />
      <line x1="12" y1="1.5" x2="12" y2="5" strokeLinecap="round" />
      <polyline points="5.5,9.5 8,12 13,7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
