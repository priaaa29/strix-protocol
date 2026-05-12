'use client';

import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { shortenAddress } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface WalletConnectProps {
  compact?: boolean;
}

export function WalletConnect({ compact = false }: WalletConnectProps) {
  const { wallet, loading, error, connect, disconnect } = useWallet();

  if (wallet.connected && wallet.address) {
    return (
      <div className={cn('flex items-center gap-2', compact ? 'w-full' : '')}>
        <div className={cn(
          'flex items-center gap-2 border border-white/[0.10] bg-white/[0.04] px-2.5 py-1.5 rounded-full',
          compact && 'flex-1 min-w-0'
        )}>
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mint opacity-50" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-mint" />
          </span>
          <span className="text-[11px] font-mono text-white/55 tabular truncate">
            {shortenAddress(wallet.address, 4)}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="shrink-0 text-white/25 hover:text-rust transition-colors duration-150 p-1 rounded-full"
          aria-label="Disconnect wallet"
          title="Disconnect"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4.5 1.5H2a1 1 0 00-1 1v7a1 1 0 001 1h2.5M8 8.5L10.5 6 8 3.5M4.5 6h6" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-1', compact && 'w-full')}>
      <Button
        size="sm"
        onClick={connect}
        loading={loading}
        className={cn(compact && 'w-full text-[11px]')}
      >
        Connect
      </Button>
      {error && (
        <p className="text-[10px] text-rust leading-tight font-sans">{error}</p>
      )}
    </div>
  );
}
