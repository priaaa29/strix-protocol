'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { TxResult } from '@/lib/types';
import { explorerTxUrl } from '@/lib/utils';
import { ACTIVE_NETWORK } from '@/lib/constants';

interface ToastProps {
  result: TxResult | null;
  onClose: () => void;
}

export function TransactionToast({ result, onClose }: ToastProps) {
  React.useEffect(() => {
    if (result?.status === 'confirmed' || result?.status === 'failed') {
      const timer = setTimeout(onClose, 8000);
      return () => clearTimeout(timer);
    }
  }, [result, onClose]);

  if (!result) return null;

  const isConfirmed = result.status === 'confirmed';
  const isPending = result.status === 'pending' || result.status === 'confirming';
  const isFailed = result.status === 'failed';

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 w-80 rounded-xl border p-4 shadow-xl',
        'bg-navy-900 backdrop-blur-sm',
        isConfirmed && 'border-green-500/50',
        isPending && 'border-amber-500/50',
        isFailed && 'border-red-500/50'
      )}
    >
      <div className="flex items-start gap-3">
        {isPending && (
          <svg className="mt-0.5 h-5 w-5 animate-spin text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {isConfirmed && (
          <svg className="mt-0.5 h-5 w-5 text-green-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
        {isFailed && (
          <svg className="mt-0.5 h-5 w-5 text-red-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">
            {isPending && 'Confirming on-chain…'}
            {isConfirmed && 'Transaction Confirmed ✓'}
            {isFailed && 'Transaction Failed ✗'}
          </p>
          {result.error && (
            <p className="mt-1 text-xs text-red-400 line-clamp-2">{result.error}</p>
          )}
          {isConfirmed && result.hash && (
            <a
              href={explorerTxUrl(result.hash, ACTIVE_NETWORK)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 text-xs text-amber-400 hover:text-amber-300 underline"
            >
              View on Stellar Expert →
            </a>
          )}
        </div>

        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 shrink-0">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}
