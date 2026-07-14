import React from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from './Button';

/* ================================================================
   RESOLVE PM — Core InsightCard Component
   Source of truth: Design Bible Phase 12-13 (Zone 3 Recommendations)
   
   Rules:
     - Promotes next actions/AI recommendations.
     - Sparkles icon indicator (16px, info color or text-muted).
     - Title + descriptive copy + optional action button.
     - Opaque surface-1/2, no glassmorphism, no hover transform.
   ================================================================ */

interface InsightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
}

export function InsightCard({
  title,
  description,
  actionLabel,
  onAction,
  actionLoading = false,
  className = '',
  ...props
}: InsightCardProps) {
  return (
    <div
      className={[
        'bg-[var(--color-surface-2)] border border-[var(--color-border-strong)]',
        'rounded-[var(--radius-lg)] p-[var(--space-4)] flex items-start gap-[var(--space-3)]',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {/* Icon container */}
      <div className="text-[var(--color-info)] mt-0.5 flex-shrink-0">
        <Sparkles size={16} strokeWidth={1.5} />
      </div>

      <div className="flex-1 flex flex-col gap-[var(--space-2)] min-w-0">
        <div className="flex flex-col gap-0.5">
          <h4 className="text-[var(--text-base)] font-medium text-[var(--color-text-primary)] leading-snug">
            {title}
          </h4>
          <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] leading-relaxed">
            {description}
          </p>
        </div>

        {actionLabel && onAction && (
          <div className="mt-[var(--space-1)]">
            <Button
              variant="secondary"
              size="sm"
              loading={actionLoading}
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
