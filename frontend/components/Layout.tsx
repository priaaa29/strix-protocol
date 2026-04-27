'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { WalletConnect } from '@/components/WalletConnect';
import { fetchXlmPrice } from '@/lib/oracle';
import { formatUsdc, formatCountdown } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { PRICE_REFRESH_MS } from '@/lib/constants';

function getNextFriday(): number {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntilFri = ((5 - day + 7) % 7) || 7;
  const fri = new Date(now);
  fri.setUTCDate(now.getUTCDate() + daysUntilFri);
  fri.setUTCHours(16, 0, 0, 0);
  return Math.floor(fri.getTime() / 1000);
}

const NAV = [
  { href: '/',          label: 'Dashboard', short: 'HOME', Icon: IconGrid     },
  { href: '/options',   label: 'Options',   short: 'OPTS', Icon: IconChart    },
  { href: '/vault',     label: 'Vault',     short: 'VAULT', Icon: IconVault   },
  { href: '/positions', label: 'Positions', short: 'POS',  Icon: IconList     },
  { href: '/explorer',  label: 'Explorer',  short: 'EXP',  Icon: IconExplorer },
] as const;

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const expiry    = getNextFriday();

  const [price,     setPrice]     = useState<bigint>(0n);
  const [prevPrice, setPrevPrice] = useState<bigint>(0n);
  const [countdown, setCountdown] = useState('');
  const [flash,     setFlash]     = useState<'up' | 'down' | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const p = await fetchXlmPrice();
        setPrice(prev => {
          setPrevPrice(prev);
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
    const tick = () => setCountdown(formatCountdown(expiry));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [expiry]);

  const priceFormatted = price > 0n ? `$${formatUsdc(price, 4)}` : null;

  return (
    <div className="app-shell">

      {/* ─────────────── LEFT RAIL (desktop) ─────────────── */}
      <aside className={cn(
        "hidden lg:flex flex-col",
        "w-[220px] flex-shrink-0 sticky top-0 h-screen overflow-y-auto",
        "bg-surface-raised border-r border-surface-border z-30"
      )}>

        {/* Logo */}
        <div className="px-5 pt-6 pb-5">
          <Link href="/" className="flex items-center gap-3 group">
            <OwlMark />
            <div className="leading-none">
              <span className="font-display text-[15px] font-bold tracking-tight text-ink">
                STRIX
              </span>
              <span className="block text-[9px] font-mono text-ink-2 tracking-[0.18em] mt-0.5">
                PROTOCOL
              </span>
            </div>
          </Link>
        </div>

        <div className="divider mx-5" />

        {/* Live market data */}
        <div className="px-5 py-5 space-y-4">
          {/* Price */}
          <div>
            <span className="label">XLM / USDC</span>
            <div className="mt-2 flex items-baseline gap-2">
              {priceFormatted ? (
                <span className={cn(
                  "data-val text-[22px] text-ink transition-none",
                  flash === 'up'   && "price-flash-up",
                  flash === 'down' && "price-flash-down",
                )}>
                  {priceFormatted}
                </span>
              ) : (
                <span className="skeleton h-7 w-20" />
              )}
              {flash === 'up'   && <span className="text-mint text-xs">▲</span>}
              {flash === 'down' && <span className="text-rust text-xs">▼</span>}
            </div>
          </div>

          {/* Expiry countdown */}
          <div>
            <span className="label">NEXT EXPIRY</span>
            <div className="mt-2">
              {countdown ? (
                <span className="data-val text-[15px] text-gold tabular">
                  {countdown}
                </span>
              ) : (
                <span className="skeleton h-5 w-16" />
              )}
            </div>
          </div>
        </div>

        <div className="divider mx-5" />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Main navigation">
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-[9px] rounded-sm",
                  "text-[11px] font-semibold tracking-[0.1em] uppercase",
                  "transition-all duration-[130ms]",
                  active
                    ? "bg-surface-over text-gold"
                    : "text-ink-2 hover:text-ink hover:bg-surface-over/60"
                )}
                aria-current={active ? 'page' : undefined}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-gold"
                    aria-hidden
                  />
                )}
                <Icon className="w-[14px] h-[14px] shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="divider mx-5" />

        {/* Wallet */}
        <div className="px-4 py-4">
          <WalletConnect compact />
        </div>

        {/* Network indicator */}
        <div className="px-5 pb-5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-40" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-gold" />
            </span>
            <span className="label text-ink-3">TESTNET</span>
          </div>
        </div>
      </aside>

      {/* ─────────────── MOBILE TOP BAR ──────────────────── */}
      <header className={cn(
        "lg:hidden sticky top-0 z-30",
        "bg-surface-raised border-b border-surface-border",
        "flex items-center justify-between px-4 h-14 w-full"
      )}>
        <Link href="/" className="flex items-center gap-2.5">
          <OwlMark compact />
          <span className="font-display text-[13px] font-bold tracking-tight text-ink">STRIX</span>
        </Link>
        <WalletConnect compact />
      </header>

      {/* ─────────────── MAIN CONTENT ────────────────────── */}
      <main className="flex-1 min-w-0 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-7 pb-28 lg:pb-10">
          {children}
        </div>
      </main>

      {/* ─────────────── MOBILE BOTTOM NAV ───────────────── */}
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {NAV.map(({ href, label, short, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-[3px] py-2.5",
                "text-[9px] font-semibold tracking-[0.12em] uppercase",
                "transition-colors duration-[130ms]",
                active ? "text-gold" : "text-ink-2"
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="w-[18px] h-[18px]" />
              {short}
            </Link>
          );
        })}
      </nav>

    </div>
  );
}

/* ─── SVG Icons ───────────────────────────────────────────── */

function OwlMark({ compact = false }: { compact?: boolean }) {
  const sz = compact ? 26 : 30;
  return (
    <svg width={sz} height={sz} viewBox="0 0 30 30" fill="none" aria-hidden>
      <rect width="30" height="30" rx="4" fill="hsl(45 96% 54% / 0.12)" />
      {/* Left eye */}
      <circle cx="11" cy="15" r="4" stroke="hsl(45 96% 54%)" strokeWidth="1.5" />
      <circle cx="11" cy="15" r="1.4" fill="hsl(45 96% 54%)" />
      {/* Right eye */}
      <circle cx="19" cy="15" r="4" stroke="hsl(45 96% 54%)" strokeWidth="1.5" />
      <circle cx="19" cy="15" r="1.4" fill="hsl(45 96% 54%)" />
      {/* Ear tufts */}
      <path d="M9 10.5L11.5 8M21 10.5L18.5 8" stroke="hsl(45 96% 54%)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="0.7" y="0.7" width="5.3" height="5.3" rx="0.5" />
      <rect x="8" y="0.7" width="5.3" height="5.3" rx="0.5" />
      <rect x="0.7" y="8" width="5.3" height="5.3" rx="0.5" />
      <rect x="8" y="8" width="5.3" height="5.3" rx="0.5" />
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
      <rect x="1" y="2.5" width="12" height="9" rx="1" />
      <circle cx="7" cy="7" r="2" />
      <line x1="9" y1="7" x2="12" y2="7" strokeLinecap="round" />
    </svg>
  );
}

function IconList({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <line x1="4.5" y1="3.5" x2="13" y2="3.5" strokeLinecap="round" />
      <line x1="4.5" y1="7"   x2="13" y2="7"   strokeLinecap="round" />
      <line x1="4.5" y1="10.5" x2="13" y2="10.5" strokeLinecap="round" />
      <circle cx="1.8" cy="3.5"  r="1.2" fill="currentColor" stroke="none" />
      <circle cx="1.8" cy="7"    r="1.2" fill="currentColor" stroke="none" />
      <circle cx="1.8" cy="10.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconExplorer({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="7" cy="7" r="5.5" />
      <circle cx="7" cy="7" r="1.5" />
      <line x1="7" y1="1.5" x2="7" y2="4"   strokeLinecap="round" />
      <line x1="7" y1="10" x2="7" y2="12.5"  strokeLinecap="round" />
      <line x1="1.5" y1="7" x2="4" y2="7"    strokeLinecap="round" />
      <line x1="10" y1="7" x2="12.5" y2="7"  strokeLinecap="round" />
    </svg>
  );
}
