import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', loading, disabled, children, ...props }, ref) => {
    const base = [
      'inline-flex items-center justify-center',
      'font-mono font-semibold uppercase tracking-[0.08em]',
      'rounded-sm',
      'border transition-all duration-[120ms]',
      'active:scale-[0.97]',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
      'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
    ].join(' ');

    const variants: Record<string, string> = {
      default: [
        'bg-gold text-surface-base border-gold',
        'hover:bg-gold-bright hover:border-gold-bright',
        'shadow-[0_0_12px_hsl(45_96%_54%/0.15)]',
        'hover:shadow-[0_0_18px_hsl(45_96%_54%/0.25)]',
      ].join(' '),
      outline: [
        'bg-transparent text-gold border-gold/50',
        'hover:border-gold hover:bg-gold/8',
      ].join(' '),
      ghost: [
        'bg-transparent text-ink-2 border-transparent',
        'hover:text-ink hover:bg-surface-over',
      ].join(' '),
      danger: [
        'bg-rust text-white border-rust',
        'hover:bg-rust-dim',
      ].join(' '),
      success: [
        'bg-mint text-surface-base border-mint',
        'hover:opacity-90',
      ].join(' '),
    };

    const sizes: Record<string, string> = {
      sm: 'h-7 px-3 text-[10px]',
      md: 'h-9 px-4 text-[11px]',
      lg: 'h-11 px-6 text-[12px]',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading && (
          <svg
            className="mr-2 h-3 w-3 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export { Button };
