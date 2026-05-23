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
    <div className="border border-dashed border-white/10 rounded-lg py-16 px-6 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.03] border border-white/5">
        <Icon className="h-6 w-6 text-white/30" />
      </div>
      <h3 className="text-sm font-mono uppercase tracking-widest text-white/50 mb-2">{title}</h3>
      <p className="text-xs text-white/30 max-w-md mx-auto leading-relaxed">{description}</p>
      {(actionLabel || secondaryLabel) && (
        <div className="mt-6 flex items-center justify-center gap-3">
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className="px-4 py-2 bg-white/10 text-white text-[10px] font-mono uppercase tracking-wider hover:bg-white/20 transition-all rounded-sm"
            >
              {actionLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button
              onClick={onSecondary}
              className="px-4 py-2 text-white/40 text-[10px] font-mono uppercase tracking-wider hover:text-white/60 transition-all"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
