'use client';

// PriceDisplay is now embedded in the sidebar (Layout.tsx).
// This component is kept for backward compatibility and renders a compact
// inline version for any page that still imports it.

import { useState, useEffect, useRef } from 'react';
import { fetchXlmPrice } from '@/lib/oracle';
import { formatUsdc, formatCountdown } from '@/lib/utils';
import { PRICE_REFRESH_MS } from '@/lib/constants';

interface PriceDisplayProps {
  nextExpiry: number;
}

export function PriceDisplay({ nextExpiry }: PriceDisplayProps) {
  const [price, setPrice]         = useState<bigint>(0n);
  const [flash, setFlash]         = useState<'up' | 'down' | null>(null);
  const [countdown, setCountdown] = useState('');
  const [loading, setLoading]     = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const p = await fetchXlmPrice();
        setPrice(prev => {
          if (prev > 0n && p !== prev) {
            if (timer.current) clearTimeout(timer.current);
            setFlash(p > prev ? 'up' : 'down');
            timer.current = setTimeout(() => setFlash(null), 800);
          }
          return p;
        });
      } catch { /* keep last */ } finally { setLoading(false); }
    };
    load();
    const id = setInterval(load, PRICE_REFRESH_MS);
    return () => { clearInterval(id); if (timer.current) clearTimeout(timer.current); };
  }, []);

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(nextExpiry));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [nextExpiry]);

  if (loading) {
    return (
      <div className="flex items-center gap-4">
        <span className="skeleton h-7 w-24" />
        <span className="skeleton h-4 w-20" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4 sm:gap-6">
      <div className="flex items-baseline gap-2">
        <span className="label">XLM/USDC</span>
        <span className={[
          "data-val text-[20px] tabular ml-2",
          flash === 'up'   ? 'price-flash-up'   : '',
          flash === 'down' ? 'price-flash-down' : '',
          !flash           ? 'text-ink'         : '',
        ].join(' ')}>
          ${formatUsdc(price, 4)}
        </span>
        {flash === 'up'   && <span className="text-mint text-xs">▲</span>}
        {flash === 'down' && <span className="text-rust text-xs">▼</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="label">EXPIRY</span>
        <span className="font-mono text-gold text-sm tabular font-semibold ml-2">{countdown}</span>
      </div>
    </div>
  );
}
