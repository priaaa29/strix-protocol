'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/hooks/useWallet';
import { usePositions } from '@/hooks/usePositions';
import { PositionCard } from '@/components/PositionCard';
import { Button } from '@/components/ui/button';
import type { Position } from '@/lib/types';

type Filter = 'all' | 'active' | 'settled' | 'claimed';

function filterPositions(positions: Position[], filter: Filter): Position[] {
  const now = Math.floor(Date.now() / 1000);
  switch (filter) {
    case 'active':  return positions.filter(p => !p.settled && p.expiry > now);
    case 'settled': return positions.filter(p => p.settled && !p.claimed);
    case 'claimed': return positions.filter(p => p.claimed);
    default:        return positions;
  }
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',     label: 'All'     },
  { key: 'active',  label: 'Active'  },
  { key: 'settled', label: 'Settled' },
  { key: 'claimed', label: 'Claimed' },
];

function SparkSvg({ size = 100 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      <path d="M50 0 L53.5 46.5 L100 50 L53.5 53.5 L50 100 L46.5 53.5 L0 50 L46.5 46.5 Z" fill="white" />
    </svg>
  );
}

export default function PositionsPage() {
  const { wallet }  = useWallet();
  const { positions, loading, error, claim } = usePositions(wallet.address);
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = filterPositions(positions, filter);

  if (!wallet.connected) {
    return (
      <div className="animate-enter space-y-8">
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
            <span className="label text-white/20 tracking-[0.14em]">Portfolio</span>
          </div>
          <h1 className="font-display text-[clamp(32px,5vw,52px)] font-bold tracking-[-0.03em] text-white leading-[0.9] mb-4">
            My Positions<span className="font-light text-white/25">.</span>
          </h1>
        </section>
        <div className="glass-card py-20 text-center">
          <p className="text-white/45 text-sm mb-1">Connect your wallet to view positions</p>
          <p className="text-white/22 text-[11px] uppercase tracking-wider font-sans">Freighter required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-enter">

      {/* ── Page header ─────────────────────────────────────── */}
      <section className="relative">
        <div className="pointer-events-none select-none absolute -top-4 right-0 opacity-[0.05]" aria-hidden>
          <div className="star-rotate-slow"><SparkSvg size={70} /></div>
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
              <span className="label text-white/20 tracking-[0.14em]">Portfolio</span>
            </div>
            <h1 className="font-display leading-[0.9] tracking-[-0.03em] text-white mb-4">
              <span className="block text-[clamp(32px,5vw,52px)] font-bold">My Positions</span>
            </h1>
            {!loading && (
              <p className="text-[12px] text-white/30 font-sans">
                {positions.length} position{positions.length !== 1 ? 's' : ''} total
              </p>
            )}
          </div>
          <Link href="/options">
            <Button variant="outline" size="sm">+ Buy Options</Button>
          </Link>
        </div>
      </section>

      {/* ── Filter tabs ─────────────────────────────────────── */}
      <div className="flex gap-1 animate-enter delay-50">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={[
              'px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] rounded-full transition-all duration-[120ms]',
              filter === key
                ? 'bg-white/[0.08] text-white border border-white/[0.15]'
                : 'text-white/30 border border-transparent hover:text-white/55',
            ].join(' ')}
          >
            {label}
            {key === 'all' && positions.length > 0 && (
              <span className="ml-1.5 text-white/25">({positions.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Loading ────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-24 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────── */}
      {error && (
        <div className="border border-rust/25 bg-rust/[0.06] rounded-2xl px-5 py-4 animate-enter">
          <p className="text-sm text-rust">{error}</p>
        </div>
      )}

      {/* ── Empty ─────────────────────────────────────────── */}
      {!loading && filtered.length === 0 && !error && (
        <div className="glass-card py-16 text-center animate-enter">
          {filter === 'all' ? (
            <>
              <p className="text-white/40 text-sm mb-1">No positions yet</p>
              <p className="text-white/22 text-[11px] mb-6 uppercase tracking-wider font-sans">
                Buy your first option to start trading
              </p>
              <Link href="/options">
                <Button size="sm">Go to Options →</Button>
              </Link>
            </>
          ) : (
            <p className="text-white/22 text-[11px] uppercase tracking-wider font-sans">
              No {filter} positions
            </p>
          )}
        </div>
      )}

      {/* ── Positions list ────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((pos, i) => (
            <div key={pos.id} className={`animate-enter delay-${Math.min(i * 50, 300)}`}>
              <PositionCard position={pos} onClaim={claim} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
