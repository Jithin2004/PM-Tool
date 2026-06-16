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
    <div className="border border-dashed border-[var(--border-soft)] bg-surface-3/5 rounded-xl py-16 px-6 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-3/30 border border-[var(--border-soft)]">
        <Icon className="h-6 w-6 text-[var(--text-secondary)]" />
      </div>
      <h3 className="text-sm font-sans font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">{description}</p>
      {(actionLabel || secondaryLabel) && (
        <div className="mt-6 flex items-center justify-center gap-3">
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className="px-4 py-2 btn-premium-primary text-[10px] font-bold uppercase tracking-wider rounded-lg"
            >
              {actionLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button
              onClick={onSecondary}
              className="px-4 py-2 btn-premium-secondary text-[10px] font-bold uppercase tracking-wider rounded-lg"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
