'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Variant = 'options' | 'vault';

const STORAGE_KEY = (v: Variant) => `strix_risk_dismissed_${v}`;

const COPY: Record<Variant, { title: string; body: string }> = {
  options: {
    title: 'Options trading risk',
    body: 'Options can expire worthless. The premium you pay is entirely at risk — you may lose 100% of it if the option expires out-of-the-money. Only trade with funds you can afford to lose.',
  },
  vault: {
    title: 'Liquidity provider risk',
    body: 'Capital deposited in the vault backs option positions. During active epochs a portion of your deposit is locked and cannot be withdrawn. Smart contract bugs or adverse price moves could result in loss of principal.',
  },
};

export function RiskDisclaimer({ variant }: { variant: Variant }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY(variant));
    if (!dismissed) setVisible(true);
  }, [variant]);

  if (!visible) return null;

  const { title, body } = COPY[variant];

  return (
    <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-rust/25 bg-rust/[0.05] mb-6">
      <span className="text-rust mt-0.5 shrink-0 text-[13px]" aria-hidden>⚠</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-rust/80 uppercase tracking-wide mb-1 font-sans">{title}</p>
        <p className="text-[11px] text-white/35 leading-relaxed font-sans">{body}{' '}
          <Link href="/terms" className="text-white/45 underline hover:text-white/65 transition-colors">
            Terms of Service
          </Link>.
        </p>
      </div>
      <button
        onClick={() => {
          localStorage.setItem(STORAGE_KEY(variant), '1');
          setVisible(false);
        }}
        className="shrink-0 text-white/22 hover:text-white/50 transition-colors text-xs mt-0.5"
        aria-label="Dismiss risk warning"
      >
        ✕
      </button>
    </div>
  );
}
