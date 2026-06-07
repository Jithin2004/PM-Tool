import { useState, useMemo } from 'react';
import type { ExecutionMode } from '../../types';
import { TransitionImpactPreview } from './TransitionImpactPreview';
import { ExecutionMigrationPlanner } from './ExecutionMigrationPlanner';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { X } from 'lucide-react';

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

  useEscapeKey(true, onClose);

  const availableModes = useMemo(
    () => EXECUTION_MODES.filter(m => m.value !== currentMode),
    [currentMode],
  );

  const handleConfirmMigration = (pid: string, mode: ExecutionMode) => {
    onMigrate(pid, mode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay-premium p-4" onClick={onClose}>
      <div className="modal-premium w-full max-w-lg rounded-2xl shadow-2xl relative overflow-hidden flex flex-col border border-[var(--border-soft)]" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-[var(--border-soft)] flex justify-between items-center">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Execution Mode Transition</h2>
            <p className="text-[10px] font-mono text-text-quaternary mt-0.5">{projectName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--pm-surface)]/5 text-text-quaternary hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {step === 'select' && (
            <>
              <div className="flex items-center gap-3 text-[10px] font-mono text-text-quaternary mb-3">
                <span>Current: <span className="text-text-tertiary">{currentMode}</span></span>
                <span>Tasks: {taskCount}</span>
                <span>Sprints: {sprintCount}</span>
              </div>

              <p className="text-[10px] font-mono text-text-tertiary mb-2">Select target execution architecture:</p>
              <div className="space-y-1.5">
                {availableModes.map(mode => (
                  <button
                    key={mode.value}
                    onClick={() => { setTargetMode(mode.value); setStep('preview'); }}
                    className="w-full flex items-center justify-between px-3 py-2 bg-surface-3 border border-border hover:border-[var(--border-soft)] transition-colors text-left"
                  >
                    <div>
                      <span className="text-xs font-mono text-text-secondary">{mode.label}</span>
                      <p className="text-[9px] font-mono text-text-quaternary">{mode.description}</p>
                    </div>
                    <span className="text-[10px] font-mono text-text-quaternary">{'>'}</span>
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
