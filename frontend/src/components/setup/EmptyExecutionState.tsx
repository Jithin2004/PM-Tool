import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyExecutionStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export function EmptyExecutionState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: EmptyExecutionStateProps) {
  return (
    <div className="border border-dashed border-border rounded-lg py-16 px-6 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-3 border border-border-subtle">
        <Icon className="h-6 w-6 text-text-quaternary" />
      </div>
      <h3 className="text-sm font-sans tracking-tight uppercase tracking-wide text-text-tertiary mb-2">{title}</h3>
      <p className="text-xs text-text-quaternary max-w-md mx-auto leading-relaxed">{description}</p>
      {(actionLabel || secondaryLabel) && (
        <div className="mt-6 flex items-center justify-center gap-3">
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className="px-4 py-2 bg-[var(--pm-surface)]/10 text-text-primary text-[10px] font-medium uppercase tracking-wider hover:bg-[var(--pm-surface)]/20 transition-all rounded-sm"
            >
              {actionLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button
              onClick={onSecondary}
              className="px-4 py-2 text-text-quaternary text-[10px] font-medium uppercase tracking-wider hover:text-text-tertiary transition-all"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
