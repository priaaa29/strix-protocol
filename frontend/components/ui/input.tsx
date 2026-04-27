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
              'w-full bg-surface-over text-ink font-mono text-sm',
              'border border-surface-border rounded-sm',
              'px-3 py-2',
              'placeholder:text-ink-3',
              'transition-all duration-[130ms]',
              'focus:outline-none focus:border-gold focus:shadow-[0_0_0_1px_hsl(45_96%_54%/0.25)]',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              error && 'border-rust focus:border-rust focus:shadow-[0_0_0_1px_hsl(355_78%_60%/0.25)]',
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
          <p id={`${inputId}-hint`} className="text-[11px] text-ink-3 leading-tight">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-[11px] text-rust leading-tight">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
export { Input };
