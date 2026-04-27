'use client';

import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { shortenAddress } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface WalletConnectProps {
  compact?: boolean;
}

export function WalletConnect({ compact = false }: WalletConnectProps) {
  const { wallet, loading, error, freighterInstalled, connect, disconnect } = useWallet();

  if (wallet.connected && wallet.address) {
    return (
      <div className={cn("flex items-center gap-2", compact ? "w-full" : "")}>
        <div className={cn(
          "flex items-center gap-2 border border-surface-border bg-surface-over px-2.5 py-1.5 rounded-sm",
          compact && "flex-1 min-w-0"
        )}>
          {/* Pulse indicator */}
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mint opacity-50" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-mint" />
          </span>
          <span className="text-2xs font-mono text-ink-2 tabular truncate">
            {shortenAddress(wallet.address, 6)}
          </span>
        </div>
        <button
          onClick={disconnect}
          className={cn(
            "shrink-0 text-ink-3 hover:text-rust transition-colors duration-150 p-1 rounded-sm",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
          )}
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

  if (freighterInstalled === false) {
    return (
      <a
        href="https://www.freighter.app/"
        target="_blank"
        rel="noopener noreferrer"
        className={cn(compact && "w-full")}
      >
        <Button variant="outline" size="sm" className={cn(compact && "w-full")}>
          Install Freighter
        </Button>
      </a>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", compact && "w-full")}>
      <Button
        size="sm"
        onClick={connect}
        loading={loading}
        className={cn(compact && "w-full")}
      >
        Connect Wallet
      </Button>
      {error && (
        <p className="text-[10px] text-rust leading-tight">{error}</p>
      )}
    </div>
  );
}
