'use client';

import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { VaultStats } from '@/components/VaultStats';
import { VaultDeposit } from '@/components/VaultDeposit';
import { VaultWithdraw } from '@/components/VaultWithdraw';
import { RiskDisclaimer } from '@/components/RiskDisclaimer';

export default function VaultPage() {
  const { wallet } = useWallet();
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');

  return (
    <div className="space-y-7 animate-enter">
      <RiskDisclaimer variant="vault" />

      {/* ── Header ──────────────────────────────────────── */}
      <div>
        <span className="label text-gold">Liquidity Provision</span>
        <h1 className="font-display text-[24px] sm:text-[30px] font-bold tracking-tight text-ink mt-2 leading-tight">
          Underwriting Vault
        </h1>
        <p className="text-[12px] text-ink-2 mt-2 max-w-lg leading-relaxed">
          Deposit USDC to underwrite options. Earn premium income when options expire out-of-the-money.
          Share price accrues all protocol fees.
        </p>
      </div>

      {/* ── Vault stats ──────────────────────────────── */}
      <VaultStats walletAddress={wallet.address} />

      {/* ── Deposit / Withdraw ───────────────────────── */}
      <div className="border border-surface-border rounded-sm overflow-hidden animate-enter delay-150">

        {/* Tab nav */}
        <div className="tab-nav bg-surface-over">
          {(['deposit', 'withdraw'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`tab-item ${tab === t ? 'active' : ''}`}
            >
              {t === 'deposit' ? 'Deposit' : 'Withdraw'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5 bg-surface-raised">
          {tab === 'deposit'
            ? <VaultDeposit  walletAddress={wallet.address} />
            : <VaultWithdraw walletAddress={wallet.address} />
          }
        </div>
      </div>

      {/* ── Mechanics ────────────────────────────────── */}
      <div className="border border-surface-border rounded-sm overflow-hidden animate-enter delay-200">
        <div className="px-5 py-3 bg-surface-over border-b border-surface-border">
          <span className="label">Vault Mechanics</span>
        </div>
        <div className="divide-y divide-surface-border">
          {[
            ['Deposit → Shares',   'USDC deposited mints vault shares at the current share price.'],
            ['Premium Accrual',    'Options purchased transfer premiums to the vault, increasing share price for all LPs.'],
            ['ITM Risk',           'If options settle in-the-money, payouts reduce vault TVL and share price.'],
            ['Withdraw Constraint','You can only withdraw unlocked capital — not the portion backing active options.'],
            ['No Lock-up',         'Withdraw at any time. Subject only to available (unlocked) capital.'],
          ].map(([title, body]) => (
            <div key={title as string} className="px-5 py-3 flex gap-4 bg-surface-raised">
              <span className="text-[11px] font-semibold text-ink-2 uppercase tracking-wider w-36 shrink-0 pt-0.5">
                {title}
              </span>
              <p className="text-[12px] text-ink-3 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
