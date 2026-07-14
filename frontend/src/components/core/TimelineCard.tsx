import React from 'react';

/* ================================================================
   RESOLVE PM — Core TimelineCard Component
   Source of truth: Design Bible Phase 12-13, 17
   
   Rules:
     - Clear time indicator, description, and status tag layout.
     - Thin borders, vertical align, simple margins.
   ================================================================ */

interface TimelineCardProps extends React.HTMLAttributes<HTMLDivElement> {
  time: string;
  title: string;
  description?: string;
  statusBadge?: React.ReactNode;
}

export function TimelineCard({
  time,
  title,
  description,
  statusBadge,
  className = '',
  ...props
}: TimelineCardProps) {
  return (
    <div
      className={[
        'flex items-start gap-[var(--space-4)] py-[var(--space-3)]',
        'border-b border-[var(--color-border)] last:border-b-0',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {/* Time Indicator: Mono 12px caption */}
      <span className="text-[var(--text-sm)] font-mono text-[var(--color-text-muted)] w-20 flex-shrink-0 pt-0.5 select-none">
        {time}
      </span>

      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="flex items-start justify-between gap-[var(--space-2)]">
          <h4 className="text-[var(--text-base)] font-medium text-[var(--color-text-primary)] leading-tight truncate">
            {title}
          </h4>
          {statusBadge && <div className="flex-shrink-0">{statusBadge}</div>}
        </div>
        {description && (
          <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
