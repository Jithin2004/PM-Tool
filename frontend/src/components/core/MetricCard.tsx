import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

/* ================================================================
   RESOLVE PM — Core MetricCard Component
   Source of truth: Design Bible Phase 10-11, 18
   
   Rules:
     - Large number (28px / text-3xl, 500 weight).
     - Label above in 11px (text-xs) uppercase muted (text-muted).
     - Delta indicator below.
     - Never more than 6 KPI cards per row (handled by layout layout/grid).
   ================================================================ */

interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  delta?: number; // percentage or offset value
  deltaLabel?: string; // e.g. "vs last week"
  trend?: 'up' | 'down' | 'neutral';
}

export function MetricCard({
  label,
  value,
  delta,
  deltaLabel,
  trend,
  className = '',
  ...props
}: MetricCardProps) {
  // Determine standard trend colors and icons based on type
  const isPositive = trend === 'up';
  const isNegative = trend === 'down';

  const trendColor = isPositive
    ? 'text-[var(--color-success)]'
    : isNegative
    ? 'text-[var(--color-danger)]'
    : 'text-[var(--color-text-muted)]';

  const TrendIcon = isPositive
    ? ArrowUpRight
    : isNegative
    ? ArrowDownRight
    : Minus;

  return (
    <div
      className={[
        'bg-[var(--color-surface-1)]',
        'border border-[var(--color-border)]',
        'rounded-[var(--radius-lg)]',
        'p-[var(--space-4)]',
        'flex flex-col gap-[var(--space-1)]',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {/* Label: 11px uppercase muted */}
      <span className="text-[var(--text-xs)] uppercase tracking-[0.06em] font-medium text-[var(--color-text-muted)] select-none">
        {label}
      </span>

      {/* Metric Value: 28px, 500 weight, tabular-nums */}
      <div className="text-[28px] font-medium leading-none tracking-tight text-[var(--color-text-primary)] font-sans tabular-nums my-[var(--space-1)]">
        {value}
      </div>

      {/* Delta indicator below */}
      {(delta !== undefined || deltaLabel) && (
        <div className="flex items-center gap-[var(--space-1)] text-[var(--text-xs)]">
          {trend && (
            <span className={`inline-flex items-center ${trendColor}`}>
              <TrendIcon size={12} strokeWidth={1.5} />
            </span>
          )}
          {delta !== undefined && (
            <span className={`font-medium font-sans ${trendColor} mr-[var(--space-1)]`}>
              {delta > 0 ? `+${delta}` : delta}%
            </span>
          )}
          {deltaLabel && (
            <span className="text-[var(--color-text-muted)]">
              {deltaLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
