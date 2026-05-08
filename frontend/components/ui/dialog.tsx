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
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[3px] animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div
        className={cn(
          'relative z-10 w-full sm:max-w-md',
          'mx-0 sm:mx-4',
          'glass-card',
          'rounded-t-3xl sm:rounded-2xl rounded-b-none sm:rounded-b-2xl',
          'animate-fade-up',
          'max-h-[90dvh] overflow-y-auto',
          className
        )}
      >
        {/* Top accent */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" aria-hidden />
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
    <div className="flex items-start justify-between px-5 py-4 border-b border-white/[0.07]">
      <div>
        <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.06em] text-white">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[11px] text-white/38 mt-0.5 font-sans">{subtitle}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-white/25 hover:text-white/65 transition-colors duration-150 ml-4 mt-0.5 p-1"
        aria-label="Close dialog"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M2 2l10 10M12 2L2 12" />
        </svg>
      </button>
    </div>
  );
}
