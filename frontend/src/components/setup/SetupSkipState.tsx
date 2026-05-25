import React from 'react';
import { ArrowRight, SkipForward } from 'lucide-react';

interface SetupSkipStateProps {
  projectName: string;
  onSkip: () => void;
  onCancel: () => void;
}

export function SetupSkipState({ projectName, onSkip, onCancel }: SetupSkipStateProps) {
  return (
    <div className="border border-border rounded-lg p-8 bg-bg">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-3">
          <SkipForward className="h-5 w-5 text-text-quaternary" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-sans tracking-tight uppercase tracking-wide text-text-secondary">Skip Execution Setup?</h3>
          <p className="mt-2 text-xs text-text-quaternary leading-relaxed">
            You can always set up epics, stories, and sprint structure later from the backlog.
            <br />
            <span className="text-text-quaternary">We'll prepare a basic workspace for {projectName} to get you started.</span>
          </p>
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={onSkip}
              className="px-4 py-2 bg-white/10 text-text-primary text-[10px] font-medium uppercase tracking-wider hover:bg-white/20 transition-all rounded-sm"
            >
              Skip Setup
            </button>
            <button
              onClick={onCancel}
              className="flex items-center gap-1 px-4 py-2 text-text-quaternary text-[10px] font-medium uppercase tracking-wider hover:text-text-tertiary transition-all"
            >
              <ArrowRight className="w-3 h-3" />
              Continue Setup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
