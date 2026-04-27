'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, children, className }: DialogProps) {
  React.useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) {
      document.addEventListener('keydown', handle);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handle);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-surface-base/80 backdrop-blur-[3px] animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div
        className={cn(
          'relative z-10 w-full max-w-md mx-4',
          'bg-surface-over border border-surface-border rounded-sm shadow-2xl',
          'animate-fade-up',
          className
        )}
      >
        {/* Gold cap accent */}
        <div className="gold-cap" aria-hidden />
        {children}
      </div>
    </div>
  );
}

interface DialogHeaderProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
}

export function DialogHeader({ title, subtitle, onClose }: DialogHeaderProps) {
  return (
    <div className="flex items-start justify-between px-5 py-4 border-b border-surface-border">
      <div>
        <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.06em] text-ink">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[11px] text-ink-2 mt-0.5">{subtitle}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-ink-3 hover:text-ink transition-colors duration-150 ml-4 mt-0.5"
        aria-label="Close dialog"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M2 2l10 10M12 2L2 12" />
        </svg>
      </button>
    </div>
  );
}
