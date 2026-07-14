import React from 'react';

/* ================================================================
   RESOLVE PM — Core Toolbar Component
   Source of truth: Design Bible Phase 12-13, 17
   
   Rules:
     - Flex layout container for filters, search and action buttons.
     - Content vertically centered.
     - Standard spacing (gap-3/4).
     - Standard borders at top/bottom or left-aligned actions.
   ================================================================ */

interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  actions?: React.ReactNode; // right-aligned controls
}

export function Toolbar({ children, actions, className = '', ...props }: ToolbarProps) {
  return (
    <div
      className={[
        'flex flex-col sm:flex-row sm:items-center justify-between gap-[var(--space-4)]',
        'py-[var(--space-3)] border-b border-[var(--color-border)] mb-[var(--space-4)]',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {/* Left side: Filters, Search, inputs */}
      <div className="flex flex-wrap items-center gap-[var(--space-3)] flex-1 min-w-0">
        {children}
      </div>

      {/* Right side: Primary CTA, View toggles, action buttons */}
      {actions && (
        <div className="flex items-center gap-[var(--space-3)] flex-shrink-0 self-end sm:self-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
