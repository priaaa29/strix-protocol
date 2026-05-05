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
    // Only show if user hasn't dismissed this variant before
    const dismissed = localStorage.getItem(STORAGE_KEY(variant));
    if (!dismissed) setVisible(true);
  }, [variant]);

  if (!visible) return null;

  const { title, body } = COPY[variant];

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded border border-rust/30 bg-rust/5 mb-6">
      <span className="text-rust mt-0.5 shrink-0" aria-hidden>⚠</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-rust uppercase tracking-wide mb-1">{title}</p>
        <p className="text-xs text-ink-2 leading-relaxed">{body}{' '}
          <Link href="/terms" className="text-ink-3 underline hover:text-ink-2 transition-colors">
            Terms of Service
          </Link>.
        </p>
      </div>
      <button
        onClick={() => {
          localStorage.setItem(STORAGE_KEY(variant), '1');
          setVisible(false);
        }}
        className="shrink-0 text-ink-3 hover:text-ink-2 transition-colors text-xs mt-0.5"
        aria-label="Dismiss risk warning"
      >
        ✕
      </button>
    </div>
  );
}
