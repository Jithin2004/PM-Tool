import React from 'react';

/* ================================================================
   RESOLVE PM — Core DashboardSection Component
   Source of truth: Design Bible Phase 12-13
   
   Rules:
     - Grouping container for dashboard grids.
     - Section heading: uppercase overline and clean section separator.
   ================================================================ */

interface DashboardSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  children: React.ReactNode;
}

export function DashboardSection({ title, children, className = '', ...props }: DashboardSectionProps) {
  return (
    <section className={['flex flex-col gap-[var(--space-4)] w-full', className].filter(Boolean).join(' ')} {...props}>
      {title && (
        <div className="border-b border-[var(--color-border)] pb-[var(--space-2)] mb-[var(--space-1)] select-none">
          <h2 className="text-[var(--text-xs)] uppercase tracking-[0.06em] font-medium text-[var(--color-text-muted)]">
            {title}
          </h2>
        </div>
      )}
      {children}
    </section>
  );
}
