import React from 'react';

/* ================================================================
   RESOLVE PM — Core PageContent Component
   Source of truth: Design Bible Phase 12-13
   
   Rules:
     - Main layout body holder.
     - Optional 12-column dashboard grid.
   ================================================================ */

interface PageContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  grid?: boolean;
}

export function PageContent({ children, grid = false, className = '', ...props }: PageContentProps) {
  return (
    <div
      className={[
        grid ? 'dashboard-grid !px-0 w-full' : 'flex flex-col gap-[var(--space-6)] w-full',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}
