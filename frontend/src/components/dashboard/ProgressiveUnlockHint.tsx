import React from 'react';
import { Sparkles } from 'lucide-react';
import type { DisclosureLevel } from '../../core/dashboard/progressiveDisclosure';

interface Props {
  message: string;
  nextLevel: DisclosureLevel;
  lockedCount: number;
  onShowAll?: () => void;
}

export function ProgressiveUnlockHint({ message, nextLevel, lockedCount, onShowAll }: Props) {
  if (lockedCount === 0) return null;

  return (
    <div className="mx-3 mb-3 rounded-md border border-indigo-500/20 bg-indigo-500/5 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-mono uppercase tracking-wide text-indigo-300/90 mb-1">
            Level {nextLevel} unlocks soon
          </p>
          <p className="text-[11px] leading-relaxed text-text-tertiary">{message}</p>
          {onShowAll && (
            <button
              type="button"
              onClick={onShowAll}
              className="mt-2 text-[10px] font-mono uppercase tracking-wider text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Show all features
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
