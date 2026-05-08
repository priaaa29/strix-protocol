'use client';

import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { VaultStats } from '@/components/VaultStats';
import { VaultDeposit } from '@/components/VaultDeposit';
import { VaultWithdraw } from '@/components/VaultWithdraw';
import { RiskDisclaimer } from '@/components/RiskDisclaimer';

function SparkSvg({ size = 100 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      <path d="M50 0 L53.5 46.5 L100 50 L53.5 53.5 L50 100 L46.5 53.5 L0 50 L46.5 46.5 Z" fill="white" />
    </svg>
  );
}

const MECHANICS = [
  ['Deposit → Shares',    'USDC deposited mints vault shares at the current share price.'],
  ['Premium Accrual',     'Options purchased transfer premiums to the vault, increasing share price for all LPs.'],
  ['ITM Risk',            'If options settle in-the-money, payouts reduce vault TVL and share price.'],
  ['Withdraw Constraint', 'You can only withdraw unlocked capital — not the portion backing active options.'],
  ['No Lock-up',          'Withdraw at any time. Subject only to available (unlocked) capital.'],
];

export default function VaultPage() {
  const { wallet } = useWallet();
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');

  return (
    <div className="space-y-8 animate-enter">

      {/* ── Page header ─────────────────────────────────────── */}
      <section className="relative">
        <div className="pointer-events-none select-none absolute -top-4 right-0 opacity-[0.05]" aria-hidden>
          <div className="star-rotate-reverse"><SparkSvg size={90} /></div>
        </div>

        <RiskDisclaimer variant="vault" />

        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
          <span className="label text-white/20 tracking-[0.14em]">Liquidity Provision</span>
        </div>

        <h1 className="font-display leading-[0.9] tracking-[-0.03em] text-white mb-4">
          <span className="block text-[clamp(32px,5vw,52px)] font-bold">Underwriting</span>
          <span className="block text-[clamp(32px,5vw,52px)] font-light text-white/25">Vault.</span>
        </h1>

        <p className="text-[12px] text-white/38 font-sans leading-relaxed max-w-md">
          Deposit USDC to underwrite options. Earn premium income when options expire out-of-the-money.
          Share price accrues all protocol fees.
        </p>
      </section>

      {/* ── Vault stats ──────────────────────────────────────── */}
      <VaultStats walletAddress={wallet.address} />

      {/* ── Deposit / Withdraw ───────────────────────────────── */}
      <div className="glass-card overflow-hidden animate-enter delay-150">
        {/* Tab nav */}
        <div className="flex border-b border-white/[0.07]">
          {(['deposit', 'withdraw'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors duration-[120ms]',
                'border-b-2 -mb-px',
                tab === t
                  ? 'text-white border-white/50'
                  : 'text-white/28 border-transparent hover:text-white/55',
              ].join(' ')}
            >
              {t === 'deposit' ? 'Deposit' : 'Withdraw'}
            </button>
          ))}
        </div>
        <div className="p-6">
          {tab === 'deposit'
            ? <VaultDeposit  walletAddress={wallet.address} />
            : <VaultWithdraw walletAddress={wallet.address} />
          }
        </div>
      </div>

      {/* ── Vault mechanics ──────────────────────────────────── */}
      <div className="animate-enter delay-200">
        <span className="label mb-5 block">Vault Mechanics</span>
        <div className="glass-card overflow-hidden">
          {MECHANICS.map(([title, body], i) => (
            <div
              key={title}
              className={`flex gap-5 px-6 py-4 ${i < MECHANICS.length - 1 ? 'border-b border-white/[0.06]' : ''}`}
            >
              <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider w-36 shrink-0 pt-0.5 font-sans">
                {title}
              </span>
              <p className="text-[12px] text-white/30 leading-relaxed font-sans">{body}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
