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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="relative w-full sm:max-w-md glass-card rounded-t-3xl sm:rounded-2xl rounded-b-none sm:rounded-b-2xl shadow-2xl max-h-[90dvh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Top accent */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-gold/50 to-transparent" aria-hidden />
        {/* Drag handle on mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center gap-3">
            <OwlIcon />
            <div>
              <h2 id="modal-title" className="font-display text-[15px] font-bold text-white tracking-tight">
                Welcome to Strix Protocol
              </h2>
              <p className="label text-white/28 mt-0.5">
                {isTestnet ? 'Testnet — no real funds' : 'Live on Stellar Mainnet'}
              </p>
            </div>
          </div>

          {isTestnet ? (
            <p className="text-[13px] text-white/45 leading-relaxed font-sans">
              You&apos;re on <strong className="text-gold">testnet</strong>. Tokens have no monetary
              value and are for testing only. The contracts are experimental — do not connect
              a wallet with real funds.
            </p>
          ) : (
            <p className="text-[13px] text-white/45 leading-relaxed font-sans">
              You&apos;re on <strong className="text-mint">mainnet</strong>. Real funds are at risk.
              Options can expire worthless and LP capital can be locked. Only trade with funds
              you can afford to lose entirely.
            </p>
          )}

          <ul className="space-y-2.5">
            {[
              'Options are cash-settled European-style — no early exercise',
              'Premium paid at purchase is non-refundable',
              'Smart contracts cannot be modified or upgraded after deployment',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="text-gold shrink-0 mt-0.5 text-[11px]">•</span>
                <span className="text-[12px] text-white/38 font-sans leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>

          <p className="text-[11px] text-white/25 leading-relaxed font-sans">
            By continuing, you accept the{' '}
            <Link href="/terms" className="text-white/45 underline hover:text-white/65 transition-colors" onClick={accept}>
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-white/45 underline hover:text-white/65 transition-colors" onClick={accept}>
              Privacy Policy
            </Link>.
          </p>

          <button
            onClick={accept}
            className="w-full py-3 text-[12px] font-semibold uppercase tracking-[0.1em] rounded-xl bg-white/[0.06] border border-white/[0.12] text-white hover:bg-white/[0.10] transition-all active:scale-[0.98]"
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
      <rect width="32" height="32" rx="8" fill="hsl(45 96% 54% / 0.08)" />
      <rect width="32" height="32" rx="8" stroke="hsl(45 96% 54% / 0.18)" strokeWidth="1" fill="none" />
      <circle cx="11.5" cy="16" r="4.2" stroke="hsl(45 96% 54%)" strokeWidth="1.4" />
      <circle cx="11.5" cy="16" r="1.5" fill="hsl(45 96% 54%)" />
      <circle cx="20.5" cy="16" r="4.2" stroke="hsl(45 96% 54%)" strokeWidth="1.4" />
      <circle cx="20.5" cy="16" r="1.5" fill="hsl(45 96% 54%)" />
      <path d="M9 11L11.5 8M23 11L20.5 8" stroke="hsl(45 96% 54%)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
