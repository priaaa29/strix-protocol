'use client';

import { useVault } from '@/hooks/useVault';
import { formatUsdcDollar, formatSharePrice, formatPercent } from '@/lib/utils';

interface VaultStatsProps {
  walletAddress: string | null;
}

export function VaultStats({ walletAddress }: VaultStatsProps) {
  const { vaultInfo, lpInfo } = useVault(walletAddress);

  const utilizationRate =
    vaultInfo && vaultInfo.tvl > 0n
      ? Number(vaultInfo.locked * 10000n / vaultInfo.tvl) / 100
      : 0;

  return (
    <div className="space-y-4">

      {/* ── Main stats ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06] border border-white/[0.06] rounded-2xl overflow-hidden">
        {[
          {
            label: 'Total TVL',
            value: vaultInfo ? formatUsdcDollar(vaultInfo.tvl, 0) : null,
            sub:   vaultInfo ? `${formatPercent(utilizationRate, 1)} locked` : '',
          },
          {
            label: 'Share Price',
            value: vaultInfo ? `$${formatSharePrice(vaultInfo.sharePrice)}` : null,
            sub:   'per share',
          },
          {
            label: 'Available',
            value: vaultInfo ? formatUsdcDollar(vaultInfo.available, 0) : null,
            sub:   'unlocked capital',
          },
          {
            label: 'Total Shares',
            value: vaultInfo ? (Number(vaultInfo.totalShares) / 1e7).toLocaleString(undefined, { maximumFractionDigits: 2 }) : null,
            sub:   'outstanding',
          },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={[
              'px-5 py-5 bg-[hsl(0,0%,3%)] group hover:bg-white/[0.02] transition-colors',
              i === 0 || i === 2 ? 'border-b sm:border-b-0 border-white/[0.06]' : '',
            ].join(' ')}
          >
            <span className="label mb-2">{stat.label}</span>
            <div className="mt-1">
              {!stat.value ? (
                <span className="skeleton h-7 w-24 inline-block" />
              ) : (
                <span className="data-val text-[22px] text-white tabular">{stat.value}</span>
              )}
            </div>
            {stat.sub && stat.value && (
              <p className="text-[11px] text-white/25 mt-1 font-sans">{stat.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* ── Utilization bar ────────────────────────────────── */}
      {vaultInfo && (
        <div className="glass-card px-5 py-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="label">Capital Utilization</span>
            <span className="font-data text-[11px] text-white/50 tabular">{formatPercent(utilizationRate, 1)}</span>
          </div>
          <div className="util-track">
            <div className="util-fill" style={{ width: `${Math.min(utilizationRate, 100)}%` }} />
          </div>
        </div>
      )}

      {/* ── LP position ────────────────────────────────────── */}
      {walletAddress && lpInfo && lpInfo.shares > 0n && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.07] bg-white/[0.02]">
            <span className="label text-gold">Your Position</span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
            {[
              { label: 'Your Shares', value: (Number(lpInfo.shares) / 1e7).toFixed(4) },
              { label: 'USDC Value',  value: formatUsdcDollar(lpInfo.usdcValue, 2) },
              { label: 'Pool Share',  value: formatPercent(lpInfo.shareOfPoolBps / 100, 3) },
            ].map((item) => (
              <div key={item.label} className="px-5 py-4">
                <span className="label mb-1.5">{item.label}</span>
                <p className="font-data text-[13px] text-white/75 tabular mt-1">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
