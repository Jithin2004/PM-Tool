import type { CoordinationDensity } from '../../core/coordination/types';
import type { CollaborationSignal } from '../../core/presence/types';

interface CoordinationRadarProps {
  density: CoordinationDensity;
  signals: CollaborationSignal[];
}

export function CoordinationRadar({ density, signals }: CoordinationRadarProps) {
  const now = Date.now();
  const recentSignals = signals.filter(s => now - new Date(s.timestamp).getTime() < 600_000);

  const editing = recentSignals.filter(s => s.type === 'editing').length;
  const reviewing = recentSignals.filter(s => s.type === 'reviewing').length;
  const planning = recentSignals.filter(s => s.type === 'planning').length;
  const blocked = recentSignals.filter(s => s.type === 'blocker').length;
  const total = recentSignals.length;

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">coordination radar</div>

      <div className="grid grid-cols-2 gap-2">
        <div className="px-2 py-1.5 bg-white/5 rounded border border-gray-200 dark:border-white/10">
          <span className="text-[18px] font-bold font-mono-pm text-text-primary">{total}</span>
          <span className="text-[10px] text-text-tertiary ml-1">signals</span>
        </div>
        <div className="px-2 py-1.5 bg-white/5 rounded border border-gray-200 dark:border-white/10">
          <span className="text-[18px] font-bold font-mono-pm text-text-primary">{density.uniqueIntents}</span>
          <span className="text-[10px] text-text-tertiary ml-1">intents</span>
        </div>
      </div>

      <div className="space-y-1">
        {editing > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-signal-safe" />
            <span className="text-[10px] text-text-tertiary flex-1">editing</span>
            <span className="text-[10px] font-mono-pm text-text-primary">{editing}</span>
          </div>
        )}
        {reviewing > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent-primary" />
            <span className="text-[10px] text-text-tertiary flex-1">reviewing</span>
            <span className="text-[10px] font-mono-pm text-text-primary">{reviewing}</span>
          </div>
        )}
        {planning > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent-secondary" />
            <span className="text-[10px] text-text-tertiary flex-1">planning</span>
            <span className="text-[10px] font-mono-pm text-text-primary">{planning}</span>
          </div>
        )}
        {blocked > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-signal-warning" />
            <span className="text-[10px] text-text-tertiary flex-1">blocked</span>
            <span className="text-[10px] font-mono-pm text-text-primary">{blocked}</span>
          </div>
        )}
      </div>

      {density.dominantIntent !== 'none' && (
        <div className="text-[10px] text-text-tertiary pt-1 border-t border-gray-200 dark:border-white/10">
          dominant: {density.dominantIntent.replace(/_/g, ' ')}
        </div>
      )}
    </div>
  );
}
