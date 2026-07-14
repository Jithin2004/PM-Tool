import React from 'react';

/* ================================================================
   RESOLVE PM — Core PageFooter Component
   Source of truth: Design Bible Phase 12-13, 18
   
   Rules:
     - Standard page footer container.
     - Thin borders, muted secondary typography.
   ================================================================ */

interface PageFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PageFooter({ children, className = '', ...props }: PageFooterProps) {
  return (
    <footer
      className={[
        'mt-[var(--space-8)] pt-[var(--space-4)] border-t border-[var(--color-border)]',
        'text-[var(--text-xs)] text-[var(--color-text-muted)] flex items-center justify-between',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </footer>
  );
}
