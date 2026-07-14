import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from './Button';

/* ================================================================
   RESOLVE PM — Core EmptyState Component
   Source of truth: Design Bible Phase 10-11, 18
   
   Rules:
     - 20px Lucide icon, centered.
     - 16px (or H3 / text-lg) title (500 weight).
     - 14px description (muted).
     - One CTA button maximum.
     - No illustrations. No emoji.
     - Background matches surrounding surface (transparent / default).
   ================================================================ */

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: LucideIcon;
  action?: React.ReactNode;
  compact?: boolean;
  accentColor?: string;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center text-center py-12 px-6',
        'bg-transparent max-w-[320px] mx-auto',
        className,
      ].filter(Boolean).join(' ')}
    >
      {/* Icon centered */}
      <div className="mb-4 text-[var(--color-text-disabled)]">
        <Icon size={24} strokeWidth={1.5} />
      </div>

      {/* Title (15px / font-medium) */}
      <h3 className="text-[15px] font-medium text-[var(--color-text-primary)] mb-2">
        {title}
      </h3>

      {/* Description (13px / normal) */}
      <p className="text-[13px] font-normal text-[var(--color-text-muted)] leading-relaxed max-w-[320px] mb-4">
        {description}
      </p>

      {/* Action Button */}
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" icon={actionIcon} onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      )}

      {/* Fallback ReactNode Action */}
      {!actionLabel && action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
}
