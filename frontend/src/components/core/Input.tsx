import React, { useId } from 'react';

/* ================================================================
   RESOLVE PM — Core Input Component
   Source of truth: Design Bible Phase 10-11, 18
   
   Rules:
     - Single input style.
     - Dark surface background, border all four sides, indigo focus ring.
     - No floating labels — always above the field.
     - Error state: red border + message below (12px / caption).
   ================================================================ */

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', disabled, ...props }, ref) => {
    const id = useId();
    const errorId = error ? `${id}-error` : undefined;
    const helperId = helperText ? `${id}-helper` : undefined;

    return (
      <div className="flex flex-col gap-[6px] w-full">
        {label && (
          <label
            htmlFor={id}
            className="text-[12px] font-medium text-[var(--color-text-secondary)]"
          >
            {label}
          </label>
        )}
        
        <input
          ref={ref}
          id={id}
          aria-invalid={!!error}
          aria-describedby={errorId || helperId}
          disabled={disabled}
          className={[
            'h-9 w-full px-3 py-2',
            'bg-[var(--color-surface-2)]',
            'text-[var(--color-text-primary)]',
            'text-[13px]',
            'border',
            error ? 'border-[var(--color-danger)]' : 'border-[var(--color-border-strong)]',
            'rounded-[var(--radius-md)]',
            'transition-all duration-[var(--dur-fast)]',
            disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:border-[var(--color-border)]',
            'focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-subtle)]',
            className,
          ].filter(Boolean).join(' ')}
          {...props}
        />

        {error && (
          <p
            id={errorId}
            className="text-[12px] text-[var(--color-danger)] leading-none mt-1"
          >
            {error}
          </p>
        )}

        {!error && helperText && (
          <p
            id={helperId}
            className="text-[12px] text-[var(--color-text-muted)] leading-none mt-1"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
