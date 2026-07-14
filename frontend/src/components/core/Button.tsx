import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';

/* ================================================================
   RESOLVE PM — Core Button Component
   Source of truth: Design Bible Phase 10-11, 18
   
   Variants:
     primary    — filled indigo, for the ONE primary action per view
     secondary  — bordered, for supporting actions
     ghost      — text-only, for tertiary actions
     destructive — danger-styled, for destructive actions
   
   Rules:
     - One primary per view. Never more than two variants in same context.
     - Never gradient. Never scale on hover.
     - Icon left of label, 8px gap.
     - Never icon-only for primary actions.
   ================================================================ */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    'bg-[var(--color-primary)]',
    'text-white',
    'border border-transparent',
    'hover:bg-[var(--color-primary-hover)]',
    'active:bg-[var(--color-primary-active)]',
    'active:scale-[0.98] transition-transform duration-[var(--dur-instant)]',
  ].join(' '),
  secondary: [
    'bg-transparent',
    'text-[var(--color-text-primary)]',
    'border border-[var(--color-border-strong)]',
    'hover:bg-[var(--color-primary-subtle)]',
    'hover:border-[var(--color-primary)]',
    'active:bg-[var(--color-primary-subtle)]/80',
    'active:scale-[0.98] transition-transform duration-[var(--dur-instant)]',
  ].join(' '),
  ghost: [
    'bg-transparent',
    'text-[var(--color-text-secondary)]',
    'border border-transparent',
    'hover:bg-[var(--color-primary-subtle)]',
    'hover:text-[var(--color-text-primary)]',
    'active:bg-[var(--color-primary-subtle)]/80',
    'active:scale-[0.98] transition-transform duration-[var(--dur-instant)]',
  ].join(' '),
  destructive: [
    'bg-[var(--color-danger)]',
    'text-white',
    'border border-transparent',
    'hover:bg-[#D02E2E]',
    'active:bg-[#B91C1C]',
    'active:scale-[0.98] transition-transform duration-[var(--dur-instant)]',
  ].join(' '),
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[var(--text-sm)] gap-1.5',
  md: 'h-9 px-4 text-[var(--text-base)] gap-2',
  lg: 'h-10 px-5 text-[var(--text-md)] gap-2',
};

const iconSizes: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const iconSize = iconSizes[size];

  return (
    <button
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center',
        'font-medium tracking-[0.01em]',
        `rounded-[var(--radius-md)]`,
        'transition-colors',
        `duration-[var(--dur-fast)]`,
        'cursor-pointer',
        'select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth ? 'w-full' : '',
        (disabled || loading) ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {loading ? (
        <Loader2 size={iconSize} strokeWidth={1.5} className="animate-spin" />
      ) : Icon ? (
        <Icon size={iconSize} strokeWidth={1.5} />
      ) : null}
      {children && <span>{children}</span>}
      {IconRight && !loading && <IconRight size={iconSize} strokeWidth={1.5} />}
    </button>
  );
}
