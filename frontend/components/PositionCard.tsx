'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TransactionStatus } from '@/components/TransactionStatus';
import { formatUsdc, formatExpiry, formatCountdown, calcPnl } from '@/lib/utils';
import type { Position, TxResult } from '@/lib/types';

interface PositionCardProps {
  position: Position;
  onClaim: (positionId: number) => Promise<TxResult>;
}

export function PositionCard({ position, onClaim }: PositionCardProps) {
  const [txResult, setTxResult] = useState<TxResult | null>(null);
  const [claiming, setClaiming] = useState(false);

  const { pnl, pnlPct, positive } = calcPnl(position.premiumPaid, position.payout, position.settled);
  const now       = Math.floor(Date.now() / 1000);
  const isExpired = position.expiry <= now;
  const isCall    = position.optionType === 'Call';

  const handleClaim = async () => {
    setClaiming(true);
    setTxResult({ hash: '', status: 'pending' });
    const result = await onClaim(position.id);
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
    <div className={`border border-surface-border rounded-sm overflow-hidden ${isCall ? 'pos-bar-call' : 'pos-bar-put'} hover:border-surface-subtle transition-colors duration-150`}>

      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-raised border-b border-surface-border">
        <div className="flex items-center gap-3">
          <span className={`badge ${isCall ? 'badge-itm' : 'badge-otm'}`}>
            {position.optionType}
          </span>
          <span className="font-mono text-sm text-ink font-medium tabular">
            ${formatUsdc(position.strike, 4)} strike
          </span>
          <span className="text-ink-3 text-xs hidden sm:inline">
            · {formatExpiry(position.expiry)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge />
          <span className="text-[10px] text-ink-3 tabular">#{position.id}</span>
        </div>
      </div>

      {/* Data row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 bg-surface-raised divide-x divide-surface-border">
        {[
          { label: 'Amount',       value: `${position.amount} XLM` },
          { label: 'Premium Paid', value: `$${formatUsdc(position.premiumPaid, 4)}` },
          { label: 'Expiry',       value: isExpired ? formatExpiry(position.expiry) : formatCountdown(position.expiry) },
          {
            label: position.settled ? 'P&L' : 'Est. P&L',
            value: position.settled
              ? `${positive ? '+' : ''}${pnlPct.toFixed(1)}%`
              : '—',
            color: position.settled ? (positive ? 'text-mint' : 'text-rust') : 'text-ink-2',
          },
        ].map((item, i) => (
          <div key={item.label} className={`px-4 py-3 ${i >= 2 ? 'border-t sm:border-t-0 border-surface-border' : ''}`}>
            <span className="label">{item.label}</span>
            <p className={`font-mono text-sm tabular mt-1.5 ${'color' in item ? item.color : 'text-ink'}`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Payout row (if settled and ITM) */}
      {position.settled && position.payout > 0n && (
        <div className="px-4 py-3 border-t border-surface-border bg-mint-bg flex items-center justify-between">
          <div>
            <span className="label text-mint/80">Settlement Payout</span>
            <p className="font-mono font-semibold text-mint tabular mt-1">
              +${formatUsdc(position.payout, 4)} USDC
            </p>
          </div>
          {!position.claimed && (
            <Button
              variant="success"
              size="sm"
              onClick={handleClaim}
              loading={claiming}
            >
              Claim
            </Button>
          )}
        </div>
      )}

      {/* Tx status */}
      {txResult && (
        <div className="px-4 pb-3">
          <TransactionStatus result={txResult} />
        </div>
      )}
    </div>
  );
}
