import { useState, useMemo } from 'react';
import type { ExecutionMode } from '../../types';
import { TransitionImpactPreview } from './TransitionImpactPreview';
import { ExecutionMigrationPlanner } from './ExecutionMigrationPlanner';

interface ExecutionModeTransitionModalProps {
  projectId: string;
  projectName: string;
  currentMode: ExecutionMode;
  taskCount: number;
  sprintCount: number;
  onMigrate: (projectId: string, mode: ExecutionMode) => void;
  onClose: () => void;
}

const EXECUTION_MODES: { value: ExecutionMode; label: string; description: string }[] = [
  { value: 'KANBAN', label: 'Kanban', description: 'Continuous flow — no sprint boundaries' },
  { value: 'SCRUM', label: 'Scrum', description: 'Time-boxed sprint lifecycle' },
  { value: 'SDLC', label: 'SDLC', description: 'Phase-gated delivery lifecycle' },
  { value: 'HYBRID', label: 'Hybrid', description: 'Kanban flow with sprint coordination' },
];

export function ExecutionModeTransitionModal({
  projectId,
  projectName,
  currentMode,
  taskCount,
  sprintCount,
  onMigrate,
  onClose,
}: ExecutionModeTransitionModalProps) {
  const [targetMode, setTargetMode] = useState<ExecutionMode>(currentMode);
  const [step, setStep] = useState<'select' | 'preview'>('select');

  const availableModes = useMemo(
    () => EXECUTION_MODES.filter(m => m.value !== currentMode),
    [currentMode],
  );

  const handleConfirmMigration = (pid: string, mode: ExecutionMode) => {
    onMigrate(pid, mode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#0c0c0c] border border-white/10 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Execution Mode Transition</h2>
          <p className="text-[10px] font-mono text-white/40 mt-0.5">{projectName}</p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {step === 'select' && (
            <>
              <div className="flex items-center gap-3 text-[10px] font-mono text-white/30 mb-3">
                <span>Current: <span className="text-white/60">{currentMode}</span></span>
                <span>Tasks: {taskCount}</span>
                <span>Sprints: {sprintCount}</span>
              </div>

              <p className="text-[10px] font-mono text-white/50 mb-2">Select target execution architecture:</p>
              <div className="space-y-1.5">
                {availableModes.map(mode => (
                  <button
                    key={mode.value}
                    onClick={() => { setTargetMode(mode.value); setStep('preview'); }}
                    className="w-full flex items-center justify-between px-3 py-2 bg-white/[0.02] border border-white/10 hover:border-white/30 transition-colors text-left"
                  >
                    <div>
                      <span className="text-xs font-mono text-white/70">{mode.label}</span>
                      <p className="text-[9px] font-mono text-white/30">{mode.description}</p>
                    </div>
                    <span className="text-[10px] font-mono text-white/20">{'>'}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              <TransitionImpactPreview
                currentMode={currentMode}
                targetMode={targetMode}
                hasTasks={taskCount > 0}
                hasSprints={sprintCount > 0}
              />
              <ExecutionMigrationPlanner
                projectId={projectId}
                currentMode={currentMode}
                targetMode={targetMode}
                onMigrate={handleConfirmMigration}
                onCancel={() => setStep('select')}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
