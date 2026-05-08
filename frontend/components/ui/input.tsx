import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  suffix?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, suffix, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-white/[0.04] text-white font-mono text-sm',
              'border border-white/[0.10] rounded-xl',
              'px-3 py-2.5',
              'placeholder:text-white/20',
              'transition-all duration-[130ms]',
              'focus:outline-none focus:border-gold/60 focus:bg-white/[0.06]',
              'focus:shadow-[0_0_0_2px_hsl(45_96%_54%/0.15)]',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              error && 'border-rust/50 focus:border-rust/70 focus:shadow-[0_0_0_2px_hsl(355_78%_60%/0.15)]',
              suffix && 'pr-16',
              className
            )}
            aria-describedby={
              error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            {...props}
          />
          {suffix && (
            <div className="absolute right-0 top-0 h-full flex items-center pr-3">
              {suffix}
            </div>
          )}
        </div>
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-[11px] text-white/25 leading-tight font-sans">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-[11px] text-rust leading-tight font-sans">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
export { Input };
