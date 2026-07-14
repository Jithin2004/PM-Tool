import React from 'react';
import { ChevronRight } from 'lucide-react';

/* ================================================================
   RESOLVE PM — Core PageHeader Component
   Source of truth: Design Bible Phase 12-13, 17
   
   Rules:
     - Page Title: H1 / 22px, 600 weight, text-primary.
     - Optional overline: UPPERCASE 11px, tracking, text-muted.
     - Optional description: 13px/14px (text-secondary).
     - Standardized navigation breadcrumb hierarchy list.
   ================================================================ */

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  overline?: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  overline,
  description,
  breadcrumbs,
  actions,
  className = '',
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={[
        'flex flex-col md:flex-row md:items-start justify-between gap-[var(--space-4)]',
        'mb-[var(--space-6)] border-b border-[var(--color-border)] pb-[var(--space-4)]',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      <div className="flex flex-col gap-[var(--space-1)] min-w-0">
        {/* Breadcrumbs / Eyebrow navigation path */}
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="flex items-center gap-[var(--space-2)] text-[var(--text-xs)] text-[var(--color-text-muted)] font-medium select-none mb-[var(--space-1)]">
            {breadcrumbs.map((item, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight size={10} strokeWidth={1.5} className="flex-shrink-0" />}
                {item.onClick ? (
                  <button
                    onClick={item.onClick}
                    className="hover:text-[var(--color-text-primary)] transition-colors focus:outline-none"
                  >
                    {item.label}
                  </button>
                ) : (
                  <span className={idx === breadcrumbs.length - 1 ? 'text-[var(--color-text-secondary)]' : ''}>
                    {item.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        ) : (
          overline && (
            <span className="text-[var(--text-xs)] uppercase tracking-[0.06em] font-medium text-[var(--color-text-muted)] select-none">
              {overline}
            </span>
          )
        )}

        {/* H1 Title: 22px, 600 weight */}
        <h1 className="text-[var(--text-2xl)] font-semibold tracking-tight text-[var(--color-text-primary)] leading-none my-1">
          {title}
        </h1>

        {/* Description: 13px/14px (text-secondary) */}
        {description && (
          <p className="text-[var(--text-base)] text-[var(--color-text-secondary)] leading-relaxed mt-1 max-w-[var(--layout-reading-width)]">
            {description}
          </p>
        )}
      </div>

      {/* Right actions panel */}
      {actions && (
        <div className="flex items-center gap-[var(--space-3)] flex-shrink-0 self-start md:self-center">
          {actions}
        </div>
      )}
    </div>
  );
}
