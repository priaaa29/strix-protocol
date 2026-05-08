'use client';

import { useState, useEffect, useCallback } from 'react';
import { redirect } from 'next/navigation';
import { TEST_ACCOUNTS, EXPLORER_URL, type TestAccount } from '@/lib/test-accounts';
import { cn } from '@/lib/utils';
import { NETWORK_CONFIG, ACTIVE_NETWORK } from '@/lib/constants';

if (ACTIVE_NETWORK === 'mainnet') {
  redirect('/');
}

const AVATAR_COLORS = [
  'bg-gold/20 text-gold border-gold/30',
  'bg-mint/20 text-mint border-mint/30',
  'bg-[hsl(265,70%,60%)]/20 text-[hsl(265,70%,70%)] border-[hsl(265,70%,60%)]/30',
  'bg-rust/20 text-rust border-rust/30',
  'bg-[hsl(200,80%,55%)]/20 text-[hsl(200,80%,65%)] border-[hsl(200,80%,55%)]/30',
  'bg-gold-dim/30 text-gold-bright border-gold/20',
];

interface AccountState {
  xlm:     string | null;
  loading: boolean;
  error:   boolean;
}

async function fetchXlmBalance(publicKey: string, horizonUrl: string): Promise<string> {
  const res = await fetch(`${horizonUrl}/accounts/${publicKey}`);
  if (!res.ok) throw new Error('not found');
  const data = await res.json();
  const native = (data.balances as Array<{ asset_type: string; balance: string }>)
    .find(b => b.asset_type === 'native');
  return native ? parseFloat(native.balance).toFixed(2) : '0.00';
}

function SparkSvg({ size = 100 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      <path d="M50 0 L53.5 46.5 L100 50 L53.5 53.5 L50 100 L46.5 53.5 L0 50 L46.5 46.5 Z" fill="white" />
    </svg>
  );
}

export default function ExplorerPage() {
  const [balances, setBalances] = useState<Record<string, AccountState>>(() =>
    Object.fromEntries(TEST_ACCOUNTS.map(a => [a.publicKey, { xlm: null, loading: true, error: false }]))
  );
  const [revealed,  setRevealed]  = useState<Record<string, boolean>>({});
  const [copied,    setCopied]    = useState<string | null>(null);
  const [refreshAt, setRefreshAt] = useState(0);

  const loadBalances = useCallback(async () => {
    setBalances(prev =>
      Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, loading: true }]))
    );
    await Promise.all(
      TEST_ACCOUNTS.map(async (acc) => {
        try {
          const xlm = await fetchXlmBalance(acc.publicKey, NETWORK_CONFIG.horizonUrl);
          setBalances(prev => ({ ...prev, [acc.publicKey]: { xlm, loading: false, error: false } }));
        } catch {
          setBalances(prev => ({ ...prev, [acc.publicKey]: { xlm: null, loading: false, error: true } }));
        }
      })
    );
  }, []);

  useEffect(() => { loadBalances(); }, [loadBalances, refreshAt]);

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  function toggleReveal(publicKey: string) {
    setRevealed(prev => ({ ...prev, [publicKey]: !prev[publicKey] }));
  }

  const totalFunded = TEST_ACCOUNTS.filter(a => a.funded).length;

  return (
    <div className="space-y-8 animate-enter">

      {/* ── Page header ─────────────────────────────────────── */}
      <section className="relative">
        <div className="pointer-events-none select-none absolute -top-4 right-0 opacity-[0.05]" aria-hidden>
          <div className="star-rotate"><SparkSvg size={80} /></div>
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
              <span className="label text-white/20 tracking-[0.14em]">Development · Testnet Only</span>
            </div>
            <h1 className="font-display leading-[0.9] tracking-[-0.03em] text-white mb-4">
              <span className="block text-[clamp(32px,5vw,52px)] font-bold">Test Account</span>
              <span className="block text-[clamp(32px,5vw,52px)] font-light text-white/25">Explorer.</span>
            </h1>
            <p className="text-[12px] text-white/38 font-sans leading-relaxed max-w-md">
              {totalFunded} testnet wallets funded via Stellar Friendbot. Simulate traders,
              LPs, and market makers on testnet.
            </p>
          </div>

          <button
            onClick={() => setRefreshAt(Date.now())}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-full',
              'text-[11px] font-semibold tracking-[0.08em] uppercase text-white/35',
              'border border-white/[0.08] hover:border-white/[0.18] hover:text-white/65',
              'transition-all duration-[120ms] bg-white/[0.03] mt-8 sm:mt-0',
            )}
          >
            <IconRefresh className="w-3.5 h-3.5" />
            Refresh Balances
          </button>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────── */}
      <div className="grid grid-cols-3 divide-x divide-white/[0.06] border border-white/[0.06] rounded-2xl overflow-hidden animate-enter delay-100">
        {[
          { label: 'Total Accounts', value: TEST_ACCOUNTS.length.toString() },
          { label: 'Funded',         value: `${totalFunded} / ${TEST_ACCOUNTS.length}` },
          { label: 'Network',        value: 'Testnet' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[hsl(0,0%,3%)] px-5 py-5 group hover:bg-white/[0.02] transition-colors">
            <span className="label mb-2">{label}</span>
            <div className="font-display text-[24px] font-bold text-white leading-none tracking-tight">{value}</div>
          </div>
        ))}
      </div>

      {/* ── Account cards ───────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 animate-enter delay-150">
        {TEST_ACCOUNTS.map((acc, i) => {
          const state   = balances[acc.publicKey];
          const isShown = revealed[acc.publicKey];

          return (
            <AccountCard
              key={acc.publicKey}
              acc={acc}
              index={i}
              state={state}
              isShown={isShown}
              copied={copied}
              avatarColor={AVATAR_COLORS[i % AVATAR_COLORS.length]}
              onCopy={copyToClipboard}
              onToggleReveal={toggleReveal}
            />
          );
        })}
      </div>

      {/* ── Footer note ─────────────────────────────────────── */}
      <div className="glass-card px-6 py-5 animate-enter delay-200">
        <div className="flex gap-3 items-start">
          <IconInfo className="w-4 h-4 text-gold shrink-0 mt-0.5" />
          <p className="text-[11px] text-white/35 leading-relaxed font-sans">
            These are <span className="text-white/55 font-semibold">testnet-only</span> accounts.
            Secret keys are safe to display here — they hold no real funds.
            Each account was funded with <span className="text-white/55 font-semibold">10,000 XLM</span> by Stellar&apos;s Friendbot.
            Accounts can be used with the Stellar Lab, soroban-cli, or any Stellar SDK to interact with the Strix Protocol contracts.
          </p>
        </div>
      </div>

    </div>
  );
}

/* ── Account Card ─────────────────────────────────────────────────────────── */

interface CardProps {
  acc:           TestAccount;
  index:         number;
  state:         AccountState;
  isShown:       boolean;
  copied:        string | null;
  avatarColor:   string;
  onCopy:        (text: string, id: string) => void;
  onToggleReveal:(publicKey: string) => void;
}

function AccountCard({ acc, index, state, isShown, copied, avatarColor, onCopy, onToggleReveal }: CardProps) {
  return (
    <div className={cn(
      'glass-card overflow-hidden',
      'animate-enter',
      index === 1 && 'delay-[60ms]',
      index === 2 && 'delay-[120ms]',
      index === 3 && 'delay-[180ms]',
      index === 4 && 'delay-[240ms]',
      index === 5 && 'delay-[300ms]',
    )}>

      {/* Card header */}
      <div className="px-5 py-4 border-b border-white/[0.07] bg-white/[0.02]">
        <div className="flex items-start gap-3">
          <div className={cn(
            'w-10 h-10 rounded-xl border flex items-center justify-center',
            'font-display text-[13px] font-bold shrink-0 tracking-tight',
            avatarColor
          )}>
            {acc.initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-display text-[13px] font-bold text-white tracking-tight">{acc.name}</div>
              {acc.funded && (
                <span className="px-2 py-0.5 rounded-full bg-mint/15 border border-mint/30 text-mint text-[9px] font-semibold tracking-widest uppercase">
                  Funded
                </span>
              )}
            </div>
            <div className="text-[10px] text-white/28 font-mono tracking-wider mt-0.5">@{acc.handle}</div>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] text-white/40 leading-relaxed font-sans">{acc.bio}</p>
          <div className="flex items-center gap-3 flex-wrap pt-0.5">
            <span className="text-[10px] text-white/25 font-mono uppercase tracking-wider">{acc.role}</span>
            <span className="text-[10px] text-white/20">·</span>
            <span className="text-[10px] text-white/25 font-sans">{acc.location}</span>
          </div>
        </div>
      </div>

      {/* XLM Balance */}
      <div className="px-5 py-3.5 border-b border-white/[0.06]">
        <span className="label mb-2">XLM Balance</span>
        <div className="flex items-baseline gap-2">
          {state.loading ? (
            <span className="skeleton h-6 w-28" />
          ) : state.error ? (
            <span className="text-rust text-[12px] font-mono">Failed to load</span>
          ) : (
            <>
              <span className="data-val text-[22px] text-white">{state.xlm}</span>
              <span className="text-[10px] text-white/28 font-mono">XLM</span>
            </>
          )}
        </div>
      </div>

      {/* Public key */}
      <div className="px-5 py-3.5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <span className="label">Public Key</span>
          <div className="flex items-center gap-3">
            <a
              href={`${EXPLORER_URL}/${acc.publicKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-gold hover:text-gold-bright font-mono tracking-wider uppercase transition-colors"
            >
              Explorer ↗
            </a>
            <button
              onClick={() => onCopy(acc.publicKey, `pub-${acc.publicKey}`)}
              className="text-white/25 hover:text-white/65 transition-colors"
              title="Copy public key"
            >
              {copied === `pub-${acc.publicKey}` ? (
                <IconCheck className="w-3.5 h-3.5 text-mint" />
              ) : (
                <IconCopy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
        <div className="font-mono text-[10px] text-white/40 break-all leading-relaxed bg-white/[0.04] rounded-lg px-3 py-2">
          {acc.publicKey}
        </div>
      </div>

      {/* Secret key */}
      <div className="px-5 py-3.5">
        <div className="flex items-center justify-between mb-2">
          <span className="label">Secret Key</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onToggleReveal(acc.publicKey)}
              className="text-[9px] text-white/25 hover:text-white/55 font-mono tracking-wider uppercase transition-colors"
            >
              {isShown ? 'Hide' : 'Reveal'}
            </button>
            {isShown && (
              <button
                onClick={() => onCopy(acc.secretKey, `sec-${acc.publicKey}`)}
                className="text-white/25 hover:text-white/65 transition-colors"
                title="Copy secret key"
              >
                {copied === `sec-${acc.publicKey}` ? (
                  <IconCheck className="w-3.5 h-3.5 text-mint" />
                ) : (
                  <IconCopy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>
        <div className="font-mono text-[10px] break-all leading-relaxed bg-white/[0.04] rounded-lg px-3 py-2 min-h-[36px]">
          {isShown ? (
            <span className="text-rust/70">{acc.secretKey}</span>
          ) : (
            <span className="text-white/18 tracking-[0.25em] select-none">
              {'●'.repeat(56)}
            </span>
          )}
        </div>
      </div>

    </div>
  );
}

/* ── SVG Icons ────────────────────────────────────────────────────────────── */

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 7A5 5 0 1 1 9.5 2.8" />
      <polyline points="9.5,1 9.5,3.5 12,3.5" />
    </svg>
  );
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="8" height="8" rx="1" />
      <path d="M3 9H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2,7 5.5,10.5 12,3.5" />
    </svg>
  );
}

function IconInfo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <circle cx="7" cy="7" r="6" />
      <line x1="7" y1="6.5" x2="7" y2="10" />
      <circle cx="7" cy="4.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
