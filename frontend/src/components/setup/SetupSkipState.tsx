import React from 'react';
import { ArrowRight, SkipForward } from 'lucide-react';

interface SetupSkipStateProps {
  projectName: string;
  onSkip: () => void;
  onCancel: () => void;
}

export function SetupSkipState({ projectName, onSkip, onCancel }: SetupSkipStateProps) {
  return (
    <div className="border border-white/10 rounded-lg p-8 bg-[#0a0a0a]">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
          <SkipForward className="h-5 w-5 text-white/40" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-mono uppercase tracking-widest text-white/70">Skip Execution Setup?</h3>
          <p className="mt-2 text-xs text-white/40 leading-relaxed">
            You can always set up epics, stories, and sprint structure later from the backlog.
            <br />
            <span className="text-white/30">We'll prepare a basic workspace for {projectName} to get you started.</span>
          </p>
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={onSkip}
              className="px-4 py-2 bg-white/10 text-white text-[10px] font-mono uppercase tracking-wider hover:bg-white/20 transition-all rounded-sm"
            >
              Skip Setup
            </button>
            <button
              onClick={onCancel}
              className="flex items-center gap-1 px-4 py-2 text-white/40 text-[10px] font-mono uppercase tracking-wider hover:text-white/60 transition-all"
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
