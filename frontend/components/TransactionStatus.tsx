'use client';

import type { TxResult } from '@/lib/types';
import { explorerTxUrl } from '@/lib/utils';
import { ACTIVE_NETWORK } from '@/lib/constants';

interface TransactionStatusProps {
  result: TxResult | null;
}

export function TransactionStatus({ result }: TransactionStatusProps) {
  if (!result || result.status === 'idle') return null;

  const { status, hash, error } = result;

  if (status === 'pending' || status === 'confirming') {
    return (
      <div className="flex items-center gap-3 border border-white/[0.08] bg-white/[0.03] px-4 py-3 rounded-xl">
        <svg className="h-3.5 w-3.5 animate-spin text-gold shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-[11px] text-gold uppercase tracking-[0.08em] font-semibold">
          {status === 'pending' ? 'Waiting for signature…' : 'Confirming on-chain…'}
        </span>
      </div>
    );
  }

  if (status === 'confirmed') {
    return (
      <div className="flex items-center gap-3 border border-mint/25 bg-mint/[0.05] px-4 py-3 rounded-xl">
        <svg className="h-3.5 w-3.5 text-mint shrink-0" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 7l3.5 3.5L12 3" />
        </svg>
        <span className="text-[11px] text-mint uppercase tracking-[0.08em] font-semibold flex-1">
          Confirmed
        </span>
        {hash && (
          <a
            href={explorerTxUrl(hash, ACTIVE_NETWORK)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-white/40 hover:text-gold transition-colors duration-150 uppercase tracking-wider hover:underline underline-offset-2"
          >
            View →
          </a>
        )}
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="border border-rust/25 bg-rust/[0.05] px-4 py-3 rounded-xl space-y-1">
        <div className="flex items-center gap-3">
          <svg className="h-3.5 w-3.5 text-rust shrink-0" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 2v6M7 10.5v.5" />
          </svg>
          <span className="text-[11px] text-rust uppercase tracking-[0.08em] font-semibold">
            Transaction Failed
          </span>
        </div>
        {error && (
          <p className="text-[10px] text-white/35 leading-relaxed pl-[22px] font-sans">{error}</p>
        )}
      </div>
    );
  }

  return null;
}
