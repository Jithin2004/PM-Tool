import type { ExecutionMode } from '../../types';

interface ExecutionMigrationPlannerProps {
  projectId: string;
  currentMode: ExecutionMode;
  targetMode: ExecutionMode;
  onMigrate: (projectId: string, mode: ExecutionMode) => void;
  onCancel: () => void;
}

export function ExecutionMigrationPlanner({ projectId, currentMode, targetMode, onMigrate, onCancel }: ExecutionMigrationPlannerProps) {
  return (
    <div className="space-y-3">
      <div className="px-2 py-1.5 bg-white/5 border border-white/10 rounded">
        <p className="text-[9px] font-mono text-white/30 uppercase tracking-wider mb-1">rollback</p>
        <p className="text-[10px] font-mono text-white/50">
          Execution mode can be changed again after migration. No data is permanently altered.
        </p>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onMigrate(projectId, targetMode)}
          className="px-4 py-1.5 bg-blue-600 text-white text-[10px] font-mono uppercase tracking-wider hover:bg-blue-500 transition-colors"
        >
          Confirm transition to {targetMode}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 bg-white/5 text-white/50 text-[10px] font-mono uppercase tracking-wider hover:bg-white/10 transition-colors border border-white/10"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
