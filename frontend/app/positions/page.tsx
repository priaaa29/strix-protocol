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

export default function PositionsPage() {
  const { wallet }  = useWallet();
  const { positions, loading, error, claim } = usePositions(wallet.address);
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = filterPositions(positions, filter);

  if (!wallet.connected) {
    return (
      <div className="animate-enter space-y-5">
        <div>
          <span className="label">Portfolio</span>
          <h1 className="font-display text-[24px] font-bold tracking-tight text-ink mt-2">My Positions</h1>
        </div>
        <div className="border border-surface-border rounded-sm py-20 text-center">
          <p className="text-ink-2 text-sm">Connect your wallet to view positions</p>
          <p className="text-ink-3 text-[11px] mt-1 uppercase tracking-wider">Freighter required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-enter">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="label">Portfolio</span>
          <h1 className="font-display text-[24px] font-bold tracking-tight text-ink mt-2">My Positions</h1>
          {!loading && (
            <p className="text-[11px] text-ink-3 mt-1 uppercase tracking-wider">
              {positions.length} position{positions.length !== 1 ? 's' : ''} total
            </p>
          )}
        </div>
        <Link href="/options">
          <Button variant="outline" size="sm">+ Buy Options</Button>
        </Link>
      </div>

      {/* ── Filter tabs ─────────────────────────────────── */}
      <div className="tab-nav animate-enter delay-50">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`tab-item ${filter === key ? 'active' : ''}`}
          >
            {label}
            {key === 'all' && positions.length > 0 && (
              <span className="ml-1.5 text-ink-3">({positions.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Loading ────────────────────────────────────── */}
      {loading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-24 w-full rounded-sm" />
          ))}
        </div>
      )}

      {/* ── Error ─────────────────────────────────────── */}
      {error && (
        <div className="border border-rust-border bg-rust-bg rounded-sm px-4 py-3 animate-enter">
          <p className="text-sm text-rust">{error}</p>
        </div>
      )}

      {/* ── Empty ─────────────────────────────────────── */}
      {!loading && filtered.length === 0 && !error && (
        <div className="border border-surface-border rounded-sm py-16 text-center animate-enter">
          {filter === 'all' ? (
            <>
              <p className="text-ink-2 text-sm">No positions yet</p>
              <p className="text-ink-3 text-[11px] mt-1 mb-5 uppercase tracking-wider">
                Buy your first option to start trading
              </p>
              <Link href="/options">
                <Button size="sm">Go to Options →</Button>
              </Link>
            </>
          ) : (
            <p className="text-ink-3 text-[11px] uppercase tracking-wider">
              No {filter} positions
            </p>
          )}
        </div>
      )}

      {/* ── Positions list ────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
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
