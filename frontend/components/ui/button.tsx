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
      'inline-flex items-center justify-center gap-2',
      'font-sans font-medium tracking-[0.03em]',
      'rounded-full',
      'border transition-all duration-[140ms]',
      'active:scale-[0.97]',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40',
      'disabled:opacity-35 disabled:cursor-not-allowed disabled:pointer-events-none',
    ].join(' ');

    const variants: Record<string, string> = {
      default: [
        'bg-white text-black border-white',
        'hover:bg-white/90',
        'shadow-[0_0_24px_rgba(255,255,255,0.08)]',
        'hover:shadow-[0_0_32px_rgba(255,255,255,0.14)]',
      ].join(' '),
      outline: [
        'bg-transparent text-white border-white/20',
        'hover:border-white/40 hover:bg-white/[0.04]',
      ].join(' '),
      ghost: [
        'bg-transparent text-white/50 border-transparent',
        'hover:text-white hover:bg-white/[0.04]',
      ].join(' '),
      danger: [
        'bg-transparent text-rust border-rust/40',
        'hover:bg-rust/[0.08] hover:border-rust/60',
      ].join(' '),
      success: [
        'bg-transparent text-mint border-mint/40',
        'hover:bg-mint/[0.08] hover:border-mint/60',
      ].join(' '),
    };

    const sizes: Record<string, string> = {
      sm: 'h-7  px-3.5 text-[11px]',
      md: 'h-9  px-5   text-[12px]',
      lg: 'h-11 px-7   text-[13px]',
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
            className="h-3 w-3 animate-spin"
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
