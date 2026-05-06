'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Error boundary]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center space-y-6">
      <div className="space-y-2">
        <p className="label text-rust">Something went wrong</p>
        <h2 className="font-display text-xl font-bold text-ink">
          An unexpected error occurred
        </h2>
        <p className="text-sm text-ink-2 max-w-sm leading-relaxed">
          {error.message || 'The page encountered an error. This may be a temporary RPC issue.'}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 text-xs font-semibold uppercase tracking-wide rounded border border-gold/40 text-gold hover:bg-gold/10 transition-colors"
        >
          Try again
        </button>
        <a
          href="/"
          className="px-4 py-2 text-xs font-semibold uppercase tracking-wide rounded border border-surface-border text-ink-2 hover:text-ink hover:border-ink-3 transition-colors"
        >
          Go home
        </a>
      </div>
    </div>
  );
}
