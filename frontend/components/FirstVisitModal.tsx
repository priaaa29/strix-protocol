'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ACTIVE_NETWORK } from '@/lib/constants';

const STORAGE_KEY = 'strix_terms_accepted_v1';

export function FirstVisitModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  const isTestnet = ACTIVE_NETWORK !== 'mainnet';

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md rounded border border-surface-border bg-surface-raised shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Gold cap */}
        <div className="h-[2px] w-full rounded-t bg-gradient-to-r from-gold/0 via-gold to-gold/0" />

        <div className="px-6 py-6 space-y-5">
          <div className="flex items-center gap-3">
            <OwlIcon />
            <div>
              <h2 id="modal-title" className="font-display text-[15px] font-bold text-ink tracking-tight">
                Welcome to Strix Protocol
              </h2>
              <p className="label text-ink-3 mt-0.5">
                {isTestnet ? 'Testnet — no real funds' : 'Live on Stellar Mainnet'}
              </p>
            </div>
          </div>

          {isTestnet ? (
            <p className="text-sm text-ink-2 leading-relaxed">
              You&apos;re on <strong className="text-gold">testnet</strong>. Tokens have no monetary
              value and are for testing only. The contracts are experimental — do not connect
              a wallet with real funds.
            </p>
          ) : (
            <p className="text-sm text-ink-2 leading-relaxed">
              You&apos;re on <strong className="text-mint">mainnet</strong>. Real funds are at risk.
              Options can expire worthless and LP capital can be locked. Only trade with funds
              you can afford to lose entirely.
            </p>
          )}

          <ul className="space-y-2 text-xs text-ink-2">
            <li className="flex items-start gap-2">
              <span className="text-gold shrink-0 mt-0.5">•</span>
              Options are cash-settled European-style — no early exercise
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gold shrink-0 mt-0.5">•</span>
              Premium paid at purchase is non-refundable
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gold shrink-0 mt-0.5">•</span>
              Smart contracts cannot be modified or upgraded after deployment
            </li>
          </ul>

          <p className="text-xs text-ink-3 leading-relaxed">
            By continuing, you accept the{' '}
            <Link href="/terms" className="text-ink-2 underline hover:text-ink" onClick={accept}>
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-ink-2 underline hover:text-ink" onClick={accept}>
              Privacy Policy
            </Link>.
          </p>

          <button
            onClick={accept}
            className="w-full py-2.5 text-xs font-semibold uppercase tracking-[0.1em] rounded bg-gold/10 border border-gold/40 text-gold hover:bg-gold/20 transition-colors"
          >
            I understand — Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function OwlIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="5" fill="hsl(45 96% 54% / 0.1)" />
      <rect width="32" height="32" rx="5" stroke="hsl(45 96% 54% / 0.2)" strokeWidth="1" fill="none" />
      <circle cx="11.5" cy="16" r="4.2" stroke="hsl(45 96% 54%)" strokeWidth="1.4" />
      <circle cx="11.5" cy="16" r="1.5" fill="hsl(45 96% 54%)" />
      <circle cx="20.5" cy="16" r="4.2" stroke="hsl(45 96% 54%)" strokeWidth="1.4" />
      <circle cx="20.5" cy="16" r="1.5" fill="hsl(45 96% 54%)" />
      <path d="M9 11L11.5 8M23 11L20.5 8" stroke="hsl(45 96% 54%)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
