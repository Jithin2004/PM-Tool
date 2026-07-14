import React from 'react';

/* ================================================================
   RESOLVE PM — Core PageShell Component
   Source of truth: Design Bible Phase 12-13, 17
   
   Rules:
     - Root layout template for page views.
     - Flex-column, width-full.
     - Automatically handles standard padding and max-widths.
   ================================================================ */

interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  maxWidth?: 'standard' | 'reading' | 'full';
}

export function PageShell({
  children,
  maxWidth = 'standard',
  className = '',
  ...props
}: PageShellProps) {
  const widthClasses = {
    standard: 'max-w-[var(--layout-content-max-width)] mx-auto px-[var(--layout-content-padding)]',
    reading: 'max-w-[var(--layout-reading-width)] mx-auto px-[var(--layout-content-padding)]',
    full: 'w-full px-0', // no max-width constraints, e.g. for Kanban boards
  };

  return (
    <div
      className={[
        'flex-1 flex flex-col w-full py-[var(--space-6)]',
        widthClasses[maxWidth],
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}
