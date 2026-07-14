import React from 'react';
import type { LucideIcon } from 'lucide-react';

/* ================================================================
   RESOLVE PM — Core StatTile Component (Dashboard Info Tile)
   Source of truth: Design Bible Phase 10-11, 18
   
   Rules:
     - Minimal visual noise.
     - Bold value (H2 or H3 / text-lg).
     - Label above (11px uppercase muted).
     - Simple Lucide icon pairing, left-aligned, text-muted color.
   ================================================================ */

interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  valueColor?: string;
}

export function StatTile({
  label,
  value,
  icon: Icon,
  valueColor = 'text-[var(--color-text-primary)]',
  className = '',
  ...props
}: StatTileProps) {
  return (
    <div
      className={[
        'bg-[var(--color-surface-1)]',
        'border border-[var(--color-border)]',
        'rounded-[var(--radius-lg)]',
        'p-[var(--space-3)]',
        'flex items-center gap-[var(--space-3)]',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {Icon && (
        <div className="text-[var(--color-text-muted)] flex-shrink-0">
          <Icon size={16} strokeWidth={1.5} />
        </div>
      )}
      <div className="flex flex-col min-w-0">
        {/* Label: 11px uppercase muted */}
        <span className="text-[var(--text-xs)] uppercase tracking-[0.06em] font-medium text-[var(--color-text-muted)] truncate select-none">
          {label}
        </span>
        {/* Value: H2 (18px) or standard bold layout */}
        <span className={`text-[var(--text-xl)] font-semibold leading-tight truncate ${valueColor}`}>
          {value}
        </span>
      </div>
    </div>
  );
}
