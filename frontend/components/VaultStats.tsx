'use client';

import { useVault } from '@/hooks/useVault';
import { formatUsdcDollar, formatSharePrice, formatPercent } from '@/lib/utils';

interface VaultStatsProps {
  walletAddress: string | null;
}

export function VaultStats({ walletAddress }: VaultStatsProps) {
  const { vaultInfo, lpInfo, loading } = useVault(walletAddress);

  const utilizationRate =
    vaultInfo && vaultInfo.tvl > 0n
      ? Number(vaultInfo.locked * 10000n / vaultInfo.tvl) / 100
      : 0;

  const estimatedApy = utilizationRate * 0.8 * 52;

  return (
    <div className="space-y-4">
      {/* Main stats */}
      <div className="border border-surface-border rounded-sm overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {[
            {
              label: 'Total TVL',
              value: vaultInfo ? formatUsdcDollar(vaultInfo.tvl, 0) : null,
              sub: vaultInfo ? `${formatPercent(utilizationRate, 1)} locked` : '',
            },
            {
              label: 'Share Price',
              value: vaultInfo ? `$${formatSharePrice(vaultInfo.sharePrice)}` : null,
              sub: 'per share',
            },
            {
              label: 'Available',
              value: vaultInfo ? formatUsdcDollar(vaultInfo.available, 0) : null,
              sub: 'unlocked capital',
            },
            {
              label: 'Est. APY',
              value: vaultInfo ? `~${estimatedApy.toFixed(1)}%` : null,
              sub: 'from premiums',
            },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={[
                'p-4 bg-surface-raised',
                i < 3 ? 'border-r border-surface-border' : '',
                i < 2 ? 'border-b sm:border-b-0 border-surface-border' : '',
              ].join(' ')}
            >
              <span className="label">{stat.label}</span>
              <div className="mt-2">
                {loading || !stat.value ? (
                  <span className="skeleton h-6 w-20" />
                ) : (
                  <span className="data-val text-[18px] text-ink tabular">{stat.value}</span>
                )}
              </div>
              {stat.sub && !loading && (
                <p className="text-[11px] text-ink-3 mt-1">{stat.sub}</p>
              )}
            </div>
          ))}
        </div>

        {/* Utilization bar */}
        {vaultInfo && (
          <div>
            <div className="px-4 py-2 border-t border-surface-border flex items-center justify-between">
              <span className="label">Capital Utilization</span>
              <span className="text-[11px] text-ink-2 tabular">{formatPercent(utilizationRate, 1)}</span>
            </div>
            <div className="util-track">
              <div className="util-fill" style={{ width: `${Math.min(utilizationRate, 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* LP position (if connected and has shares) */}
      {walletAddress && lpInfo && lpInfo.shares > 0n && (
        <div className="border border-surface-border rounded-sm overflow-hidden">
          <div className="px-4 py-3 bg-surface-over border-b border-surface-border">
            <span className="label text-gold">Your Position</span>
          </div>
          <div className="grid grid-cols-3 bg-surface-raised">
            {[
              { label: 'Your Shares',   value: (Number(lpInfo.shares) / 1e7).toFixed(4) },
              { label: 'USDC Value',    value: formatUsdcDollar(lpInfo.usdcValue, 2) },
              { label: 'Pool Share',    value: formatPercent(lpInfo.shareOfPoolBps / 100, 3) },
            ].map((item, i) => (
              <div key={item.label} className={`p-4 ${i < 2 ? 'border-r border-surface-border' : ''}`}>
                <span className="label">{item.label}</span>
                <p className="font-mono text-sm text-ink tabular mt-1.5">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
