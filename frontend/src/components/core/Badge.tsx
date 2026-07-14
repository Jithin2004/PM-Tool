import React from 'react';

/* ================================================================
   RESOLVE PM — Core Badge Component
   Source of truth: Design Bible Phase 10-11, 18
   
   Rules:
     - Always semantic: color encodes meaning (success, warning, danger, info, default/muted).
     - Text + colored background.
     - 4px radius (radius-sm).
     - Never gradient.
     - Width constrained to content (inline-flex).
     - No decorative badges.
   ================================================================ */

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'primary' | 'review' | 'high_priority';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-[rgba(34,211,160,0.15)] text-[#22D3A0]', // Completed
  warning: 'bg-[rgba(245,158,11,0.15)] text-[#F59E0B]', // At Risk
  danger: 'bg-[rgba(239,68,68,0.15)] text-[#EF4444]', // Blocked
  info: 'bg-[rgba(96,165,250,0.15)] text-[#60A5FA]', // In Progress
  muted: 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]', // Not Started
  primary: 'bg-[rgba(79,109,255,0.15)] text-[var(--color-primary)]',
  review: 'bg-[rgba(167,139,250,0.15)] text-[#A78BFA]',
  high_priority: 'bg-[rgba(239,68,68,0.25)] text-[#EF4444]',
};

export function Badge({ variant = 'muted', children, className = '', ...props }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-[2px]',
        'text-[11px] font-medium leading-none tracking-wide',
        'rounded-[var(--radius-sm)]',
        'select-none',
        variantStyles[variant],
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </span>
  );
}
