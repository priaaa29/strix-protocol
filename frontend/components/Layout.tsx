'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { WalletConnect } from '@/components/WalletConnect';
import { FirstVisitModal } from '@/components/FirstVisitModal';
import { fetchXlmPrice } from '@/lib/oracle';
import { formatUsdc, formatCountdown } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { PRICE_REFRESH_MS, ACTIVE_NETWORK } from '@/lib/constants';

const IS_TESTNET = ACTIVE_NETWORK !== 'mainnet';

function getNextFriday(): number {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntilFri = ((5 - day + 7) % 7) || 7;
  const fri = new Date(now);
  fri.setUTCDate(now.getUTCDate() + daysUntilFri);
  fri.setUTCHours(16, 0, 0, 0);
  return Math.floor(fri.getTime() / 1000);
}

const ALL_NAV = [
  { href: '/',          label: 'Dashboard', short: 'HOME',  Icon: IconGrid,     testnetOnly: false },
  { href: '/options',   label: 'Options',   short: 'OPTS',  Icon: IconChart,    testnetOnly: false },
  { href: '/vault',     label: 'Vault',     short: 'VAULT', Icon: IconVault,    testnetOnly: false },
  { href: '/positions', label: 'Positions', short: 'POS',   Icon: IconList,     testnetOnly: false },
  { href: '/metrics',   label: 'Metrics',   short: 'METS',  Icon: IconMetrics,  testnetOnly: false },
  { href: '/explorer',  label: 'Explorer',  short: 'EXP',   Icon: IconExplorer, testnetOnly: true  },
] as const;

const NAV = ALL_NAV.filter(n => !n.testnetOnly || IS_TESTNET);

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const expiry    = getNextFriday();

  const [price,     setPrice]     = useState<bigint>(0n);
  const [flash,     setFlash]     = useState<'up' | 'down' | null>(null);
  const [countdown, setCountdown] = useState('');
  const [lastFetch, setLastFetch] = useState<number>(0);
  const [stale,     setStale]     = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const p = await fetchXlmPrice();
        setLastFetch(Date.now());
        setStale(false);
        setPrice(prev => {
          if (prev > 0n && p !== prev) {
            if (flashTimer.current) clearTimeout(flashTimer.current);
            setFlash(p > prev ? 'up' : 'down');
            flashTimer.current = setTimeout(() => setFlash(null), 800);
          }
          return p;
        });
      } catch { /* keep last */ }
    };
    load();
    const id = setInterval(load, PRICE_REFRESH_MS);
    return () => { clearInterval(id); if (flashTimer.current) clearTimeout(flashTimer.current); };
  }, []);

  useEffect(() => {
    if (lastFetch === 0) return;
    const check = setInterval(() => {
      setStale(Date.now() - lastFetch > 5 * 60 * 1000);
    }, 30_000);
    return () => clearInterval(check);
  }, [lastFetch]);

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(expiry));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [expiry]);

  const priceStr = price > 0n ? formatUsdc(price, 4) : null;

  return (
    <div className="app-shell">
      <FirstVisitModal />

      {/* ─────────────── LEFT RAIL (desktop) ─────────────── */}
      <aside className={cn(
        "hidden lg:flex flex-col",
        "w-[220px] flex-shrink-0 sticky top-0 h-screen overflow-y-auto",
        "border-r border-white/[0.06] z-30",
        "bg-[rgba(5,5,5,0.85)] backdrop-blur-xl"
      )}>

        {/* Logo */}
        <div className="px-5 pt-6 pb-5">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="logo-glow">
              <StrixMark />
            </div>
            <div className="leading-none">
              <span className="font-display text-[15px] font-bold tracking-[-0.01em] text-white">
                STRIX
              </span>
              <span className="block text-[9px] font-sans text-white/30 tracking-[0.2em] mt-[4px] uppercase">
                Protocol
              </span>
            </div>
          </Link>
        </div>

        <div className="divider" />

        {/* Live price ticker */}
        <div className="px-5 py-5">
          <div className="flex items-center justify-between mb-3">
            <span className="label">XLM / USDC</span>
            {stale ? (
              <span className="label text-rust/70">STALE</span>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/40 opacity-60" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white/60" />
                </span>
                <span className="label" style={{ color: 'rgba(255,255,255,0.35)' }}>LIVE</span>
              </div>
            )}
          </div>

          <div className="flex items-end gap-2">
            {priceStr ? (
              <>
                <span className={cn(
                  "font-display text-[26px] font-bold tracking-tight text-white leading-none tabular",
                  flash === 'up'   && "price-flash-up",
                  flash === 'down' && "price-flash-down",
                )}>
                  ${priceStr}
                </span>
                {flash && (
                  <span className={cn(
                    "text-[11px] mb-0.5 font-sans font-semibold",
                    flash === 'up' ? 'text-mint' : 'text-rust'
                  )}>
                    {flash === 'up' ? '▲' : '▼'}
                  </span>
                )}
              </>
            ) : (
              <span className="skeleton h-7 w-20" />
            )}
          </div>

          {/* Next expiry */}
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <span className="label mb-1.5">Next Expiry</span>
            {countdown ? (
              <span className="font-data text-[13px] text-white/70 tabular block">
                {countdown}
              </span>
            ) : (
              <span className="skeleton h-4 w-16" />
            )}
          </div>
        </div>

        <div className="divider" />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-px" aria-label="Main navigation">
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-lg",
                  "text-[12px] font-sans font-medium",
                  "transition-all duration-[120ms]",
                  active
                    ? "bg-white/[0.07] text-white"
                    : "text-white/35 hover:text-white/70 hover:bg-white/[0.04]"
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={cn(
                  "w-[14px] h-[14px] shrink-0 transition-colors duration-[120ms]",
                  active ? "text-white" : "text-white/25 group-hover:text-white/50"
                )} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="divider" />

        {/* Wallet */}
        <div className="px-4 py-3.5">
          <WalletConnect compact />
        </div>

        {/* Network + legal */}
        <div className="px-5 pb-5 space-y-2">
          <span className={cn(
            'label text-[9px]',
            IS_TESTNET ? 'text-white/20' : 'text-mint/50'
          )}>
            {IS_TESTNET ? '● Testnet' : '● Mainnet'}
          </span>
          <div className="flex items-center gap-3">
            <Link href="/terms"   className="label text-[9px] text-white/20 hover:text-white/40 transition-colors">Terms</Link>
            <Link href="/privacy" className="label text-[9px] text-white/20 hover:text-white/40 transition-colors">Privacy</Link>
          </div>
        </div>

      </aside>

      {/* ─────────────── CONTENT COLUMN (mobile: full width) ── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Mobile top bar — stacks above main in the column */}
        <header className={cn(
          "lg:hidden sticky top-0 z-30",
          "bg-[rgba(5,5,5,0.88)] backdrop-blur-xl",
          "border-b border-white/[0.06]",
          "flex items-center justify-between px-4 h-14 gap-3"
        )}>
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <StrixMark compact />
            <span className="font-display text-[14px] font-bold tracking-tight text-white">STRIX</span>
          </Link>
          {priceStr && (
            <span className={cn(
              "font-display text-[13px] font-bold text-white tabular",
              flash === 'up' && "price-flash-up",
              flash === 'down' && "price-flash-down",
            )}>
              ${priceStr}
            </span>
          )}
          <div className="shrink-0">
            <WalletConnect compact />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 pb-28 lg:pb-14">
            {children}
          </div>
        </main>

      </div>{/* end content column */}

      {/* ─────────────── MOBILE BOTTOM NAV ───────────────── */}
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {NAV.map(({ href, short, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 py-2.5",
                "text-[8.5px] font-sans font-medium tracking-[0.12em] uppercase",
                "transition-colors duration-[120ms]",
                active ? "text-white" : "text-white/25"
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="w-[17px] h-[17px]" />
              {short}
            </Link>
          );
        })}
      </nav>

    </div>
  );
}

/* ─── Strix Mark (logo) ────────────────────────────────── */

function StrixMark({ compact = false }: { compact?: boolean }) {
  const sz = compact ? 26 : 30;
  return (
    <svg width={sz} height={sz} viewBox="0 0 30 30" fill="none" aria-hidden>
      <rect width="30" height="30" rx="8" fill="rgba(255,255,255,0.06)" />
      <rect width="30" height="30" rx="8" stroke="rgba(255,255,255,0.1)" strokeWidth="1" fill="none" />
      {/* 4-pointed star */}
      <path
        d="M15 4 L16.2 13.8 L26 15 L16.2 16.2 L15 26 L13.8 16.2 L4 15 L13.8 13.8 Z"
        fill="white"
        opacity="0.9"
      />
    </svg>
  );
}

/* ─── SVG Icons ────────────────────────────────────────── */

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="0.7" y="0.7" width="5.3" height="5.3" rx="1" />
      <rect x="8" y="0.7" width="5.3" height="5.3" rx="1" />
      <rect x="0.7" y="8" width="5.3" height="5.3" rx="1" />
      <rect x="8" y="8" width="5.3" height="5.3" rx="1" />
    </svg>
  );
}

function IconChart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <polyline points="1,11 4,6.5 7,8 10.5,3 13,5" strokeLinejoin="round" strokeLinecap="round" />
      <line x1="1" y1="13" x2="13" y2="13" strokeLinecap="round" />
    </svg>
  );
}

function IconVault({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1" y="2.5" width="12" height="9" rx="1.5" />
      <circle cx="7" cy="7" r="2" />
      <line x1="9" y1="7" x2="12" y2="7" strokeLinecap="round" />
    </svg>
  );
}

function IconList({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <line x1="4.5" y1="3.5"  x2="13" y2="3.5"  strokeLinecap="round" />
      <line x1="4.5" y1="7"    x2="13" y2="7"    strokeLinecap="round" />
      <line x1="4.5" y1="10.5" x2="13" y2="10.5" strokeLinecap="round" />
      <circle cx="1.8" cy="3.5"  r="1.2" fill="currentColor" stroke="none" />
      <circle cx="1.8" cy="7"    r="1.2" fill="currentColor" stroke="none" />
      <circle cx="1.8" cy="10.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconMetrics({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1.5" y1="12.5" x2="12.5" y2="12.5" />
      <rect x="2.5" y="8" width="1.8" height="4" />
      <rect x="6" y="5" width="1.8" height="7" />
      <rect x="9.5" y="2" width="1.8" height="10" />
    </svg>
  );
}

function IconExplorer({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="7" cy="7" r="5.5" />
      <circle cx="7" cy="7" r="1.5" />
      <line x1="7" y1="1.5" x2="7" y2="4"   strokeLinecap="round" />
      <line x1="7" y1="10"  x2="7" y2="12.5" strokeLinecap="round" />
      <line x1="1.5" y1="7" x2="4"   y2="7"  strokeLinecap="round" />
      <line x1="10"  y1="7" x2="12.5" y2="7" strokeLinecap="round" />
    </svg>
  );
}
