import React from 'react';

/* ================================================================
   RESOLVE PM — Core Card Component
   Source of truth: Design Bible Phase 10-11, 18
   
   Rules:
     - One card style: surface-1 background, 1px border, 8px radius.
     - No drop shadows on cards. Elevation through background lightness.
     - No card hover effects that lift or scale.
   ================================================================ */

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div
      className={[
        'bg-[var(--color-surface-1)]',
        'border border-[var(--color-border-strong)]',
        'rounded-[var(--radius-lg)]',
        'p-4',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardSubProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardHeader({ children, className = '', ...props }: CardSubProps) {
  return (
    <div
      className={[
        'border-b border-[var(--color-border-strong)] pb-4 mb-4 flex justify-between items-center',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardContent({ children, className = '', ...props }: CardSubProps) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
