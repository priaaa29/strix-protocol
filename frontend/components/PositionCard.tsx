'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TransactionStatus } from '@/components/TransactionStatus';
import { formatUsdc, formatExpiry, formatCountdown, calcPnl } from '@/lib/utils';
import type { Position, TxResult } from '@/lib/types';

interface PositionCardProps {
  position: Position;
  onClaim: (positionId: number, onProgress?: (next: TxResult) => void) => Promise<TxResult>;
}

export function PositionCard({ position, onClaim }: PositionCardProps) {
  const [txResult, setTxResult] = useState<TxResult | null>(null);
  const [claiming, setClaiming] = useState(false);

  const { pnl: _pnl, pnlPct, positive } = calcPnl(position.premiumPaid, position.payout, position.settled);
  const now       = Math.floor(Date.now() / 1000);
  const isExpired = position.expiry <= now;
  const isCall    = position.optionType === 'Call';

  const handleClaim = async () => {
    setClaiming(true);
    setTxResult({ hash: '', status: 'pending' });
    const result = await onClaim(position.id, (next) => setTxResult(next));
    setTxResult(result);
    setClaiming(false);
  };

  const StatusBadge = () => {
    if (!position.settled) {
      return isExpired
        ? <span className="badge badge-expired">Awaiting Settlement</span>
        : <span className="badge badge-live">Active</span>;
    }
    if (position.payout > 0n) {
      return position.claimed
        ? <span className="badge badge-itm">Claimed</span>
        : <span className="badge badge-claim">Claim Available</span>;
    }
    return <span className="badge badge-expired">Expired OTM</span>;
  };

  return (
    <div className={[
      'glass-card overflow-hidden',
      isCall ? 'border-l-2 border-l-mint/50' : 'border-l-2 border-l-rust/50',
    ].join(' ')}>

      {/* Header row */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-white/[0.025] border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <span className={`badge ${isCall ? 'badge-itm' : 'badge-otm'}`}>
            {position.optionType}
          </span>
          <span className="font-data text-[13px] text-white/75 tabular">
            ${formatUsdc(position.strike, 4)} strike
          </span>
          <span className="text-white/25 text-[11px] hidden sm:inline font-sans">
            · {formatExpiry(position.expiry)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge />
          <span className="text-[10px] text-white/22 tabular font-sans">#{position.id}</span>
        </div>
      </div>

      {/* Data row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-white/[0.06]">
        {[
          { label: 'Amount',       value: `${position.amount} XLM` },
          { label: 'Premium Paid', value: `$${formatUsdc(position.premiumPaid, 4)}` },
          { label: 'Expiry',       value: isExpired ? formatExpiry(position.expiry) : formatCountdown(position.expiry) },
          {
            label: position.settled ? 'P&L' : 'Est. P&L',
            value: position.settled ? `${positive ? '+' : ''}${pnlPct.toFixed(1)}%` : '—',
            color: position.settled ? (positive ? 'text-mint' : 'text-rust') : 'text-white/40',
          },
        ].map((item, i) => (
          <div key={item.label} className="px-5 py-3.5">
            <span className="label mb-1.5">{item.label}</span>
            <p className={`font-data text-[12px] tabular mt-1 ${'color' in item ? item.color : 'text-white/65'}`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Payout row (if settled and ITM) */}
      {position.settled && position.payout > 0n && (
        <div className="px-5 py-3.5 border-t border-white/[0.06] bg-mint/[0.04] flex items-center justify-between">
          <div>
            <span className="label text-mint/70 mb-1">Settlement Payout</span>
            <p className="font-data font-semibold text-mint tabular mt-0.5">
              +${formatUsdc(position.payout, 4)} USDC
            </p>
          </div>
          {!position.claimed && (
            <Button variant="success" size="sm" onClick={handleClaim} loading={claiming}>
              Claim
            </Button>
          )}
        </div>
      )}

      {txResult && (
        <div className="px-5 pb-4">
          <TransactionStatus result={txResult} />
        </div>
      )}
    </div>
  );
}
