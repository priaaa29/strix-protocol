'use client';

import { useState, useEffect, useCallback } from 'react';
import { TEST_ACCOUNTS, EXPLORER_URL, type TestAccount } from '@/lib/test-accounts';
import { cn } from '@/lib/utils';
import { NETWORK_CONFIG } from '@/lib/constants';

// ── Avatar colors cycling through brand palette ─────────────────────────────
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
    <div className="space-y-7 animate-enter">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="label text-gold">Development</span>
          <h1 className="font-display text-[24px] sm:text-[30px] font-bold tracking-tight text-ink mt-2 leading-tight">
            Test Account Explorer
          </h1>
          <p className="text-[12px] text-ink-2 mt-2 max-w-lg leading-relaxed">
            {totalFunded} testnet wallets funded via Stellar Friendbot. Use these accounts to
            simulate traders, LPs, and market makers on testnet.
          </p>
        </div>
        <button
          onClick={() => setRefreshAt(Date.now())}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-sm border border-surface-border",
            "text-[11px] font-semibold tracking-[0.08em] uppercase text-ink-2",
            "hover:text-ink hover:border-surface-subtle transition-colors duration-[130ms]",
            "bg-surface-raised mt-8 sm:mt-0"
          )}
        >
          <IconRefresh className="w-3.5 h-3.5" />
          Refresh Balances
        </button>
      </div>

      {/* ── Stats bar ───────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-px bg-surface-border rounded-sm overflow-hidden animate-enter delay-100">
        {[
          { label: 'Total Accounts', value: TEST_ACCOUNTS.length.toString() },
          { label: 'Funded',         value: `${totalFunded} / ${TEST_ACCOUNTS.length}` },
          { label: 'Network',        value: 'Testnet' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-surface-raised px-5 py-4">
            <span className="label">{label}</span>
            <div className="data-val text-[18px] text-ink mt-1">{value}</div>
          </div>
        ))}
      </div>

      {/* ── Account cards ───────────────────────────────── */}
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

      {/* ── Footer note ─────────────────────────────────── */}
      <div className="border border-surface-border rounded-sm px-5 py-4 bg-surface-raised animate-enter delay-200">
        <div className="flex gap-3 items-start">
          <IconInfo className="w-4 h-4 text-gold shrink-0 mt-0.5" />
          <p className="text-[11px] text-ink-3 leading-relaxed">
            These are <span className="text-ink-2 font-semibold">testnet-only</span> accounts.
            Secret keys are safe to display here — they hold no real funds.
            Each account was funded with <span className="text-ink-2 font-semibold">10,000 XLM</span> by Stellar's Friendbot.
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
      "border border-surface-border rounded-sm bg-surface-raised overflow-hidden",
      "animate-enter",
      index === 1 && "delay-[60ms]",
      index === 2 && "delay-[120ms]",
      index === 3 && "delay-[180ms]",
      index === 4 && "delay-[240ms]",
      index === 5 && "delay-[300ms]",
    )}>

      {/* Card header */}
      <div className="px-4 py-4 flex items-center gap-3 border-b border-surface-border bg-surface-over">
        <div className={cn(
          "w-9 h-9 rounded-sm border flex items-center justify-center",
          "font-display text-[15px] font-bold shrink-0",
          avatarColor
        )}>
          {acc.name[0]}
        </div>
        <div className="min-w-0">
          <div className="font-display text-[13px] font-bold text-ink tracking-tight">{acc.name}</div>
          <div className="text-[10px] text-ink-3 font-mono tracking-wider uppercase mt-0.5">{acc.role}</div>
        </div>
        {acc.funded && (
          <span className="ml-auto shrink-0 px-2 py-0.5 rounded-full bg-mint/15 border border-mint/30 text-mint text-[9px] font-semibold tracking-widest uppercase">
            Funded
          </span>
        )}
      </div>

      {/* XLM Balance */}
      <div className="px-4 py-3 border-b border-surface-border">
        <span className="label">XLM Balance</span>
        <div className="mt-1.5 flex items-baseline gap-2">
          {state.loading ? (
            <span className="skeleton h-6 w-28" />
          ) : state.error ? (
            <span className="text-rust text-[12px] font-mono">Failed to load</span>
          ) : (
            <>
              <span className="data-val text-[20px] text-ink">{state.xlm}</span>
              <span className="text-[10px] text-ink-3 font-mono">XLM</span>
            </>
          )}
        </div>
      </div>

      {/* Public key */}
      <div className="px-4 py-3 border-b border-surface-border">
        <div className="flex items-center justify-between mb-1.5">
          <span className="label">Public Key</span>
          <div className="flex items-center gap-2">
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
              className="text-ink-3 hover:text-ink transition-colors"
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
        <div className="font-mono text-[10px] text-ink-2 break-all leading-relaxed bg-surface-base/60 rounded-sm px-2.5 py-2">
          {acc.publicKey}
        </div>
      </div>

      {/* Secret key */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="label">Secret Key</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleReveal(acc.publicKey)}
              className="text-[9px] text-ink-3 hover:text-ink font-mono tracking-wider uppercase transition-colors"
            >
              {isShown ? 'Hide' : 'Reveal'}
            </button>
            {isShown && (
              <button
                onClick={() => onCopy(acc.secretKey, `sec-${acc.publicKey}`)}
                className="text-ink-3 hover:text-ink transition-colors"
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
        <div className="font-mono text-[10px] break-all leading-relaxed bg-surface-base/60 rounded-sm px-2.5 py-2 min-h-[36px]">
          {isShown ? (
            <span className="text-rust/80">{acc.secretKey}</span>
          ) : (
            <span className="text-ink-3 tracking-[0.25em] select-none">
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
