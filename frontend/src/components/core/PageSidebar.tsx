import React from 'react';

/* ================================================================
   RESOLVE PM — Core PageSidebar Component
   Source of truth: Design Bible Phase 12-13
   
   Rules:
     - Right-side content panels, drawers or preview details.
     - Sized strictly at 380px layout panel-width constraint.
   ================================================================ */

interface PageSidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PageSidebar({ children, className = '', ...props }: PageSidebarProps) {
  return (
    <aside
      className={[
        'w-full md:w-[var(--layout-panel-width)] flex-shrink-0',
        'border-t md:border-t-0 md:border-l border-[var(--color-border)]',
        'p-[var(--space-4)] md:pl-[var(--space-6)]',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </aside>
  );
}
