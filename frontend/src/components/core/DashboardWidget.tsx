import React from 'react';

/* ================================================================
   RESOLVE PM — Core DashboardWidget Component
   Source of truth: Design Bible Phase 12-13, 17, 18
   
   Rules:
     - Follows standard Card boundaries: surface-1, border, 8px radius.
     - Optional header with title (H3 / 15px font-medium) and action slots.
     - Spacing matching design tokens.
   ================================================================ */

interface DashboardWidgetProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardWidget({
  title,
  subtitle,
  headerActions,
  children,
  className = '',
  ...props
}: DashboardWidgetProps) {
  return (
    <div
      className={[
        'bg-[var(--color-surface-1)] border border-[var(--color-border)]',
        'rounded-[var(--radius-lg)] p-[var(--space-4)] flex flex-col gap-[var(--space-3)]',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {/* Widget Header */}
      {(title || subtitle || headerActions) && (
        <div className="flex items-start justify-between gap-[var(--space-3)] pb-[var(--space-2)] border-b border-[var(--color-border)] select-none">
          <div className="flex flex-col min-w-0">
            {title && (
              <h3 className="text-[var(--text-lg)] font-medium text-[var(--color-text-primary)] truncate">
                {title}
              </h3>
            )}
            {subtitle && (
              <span className="text-[var(--text-xs)] text-[var(--color-text-muted)] truncate">
                {subtitle}
              </span>
            )}
          </div>
          {headerActions && (
            <div className="flex items-center gap-[var(--space-2)] flex-shrink-0">
              {headerActions}
            </div>
          )}
        </div>
      )}

      {/* Widget Content */}
      <div className="flex-1 min-w-0 text-[var(--text-base)] text-[var(--color-text-secondary)]">
        {children}
      </div>
    </div>
  );
}
