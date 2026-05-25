import type { VitalityScore } from '../../core/coordination/types';

interface OperationalVitalityBarProps {
  vitality: VitalityScore;
}

const LEVEL_COLORS: Record<string, string> = {
  strong: 'bg-green-500',
  healthy: 'bg-emerald-400',
  moderate: 'bg-amber-400',
  low: 'bg-red-400',
};

const LEVEL_BG: Record<string, string> = {
  strong: 'bg-green-50 border-border',
  healthy: 'bg-emerald-50 border-emerald-200',
  moderate: 'bg-amber-50 border-border',
  low: 'bg-red-50 border-red-200',
};

function VitalityMeter({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  let color = 'bg-gray-300';
  if (pct >= 75) color = 'bg-green-500';
  else if (pct >= 50) color = 'bg-emerald-400';
  else if (pct >= 25) color = 'bg-amber-400';
  else color = 'bg-red-400';

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-500 w-20 text-right">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-400 w-6 font-mono">{value}</span>
    </div>
  );
}

export function OperationalVitalityBar({ vitality }: OperationalVitalityBarProps) {
  return (
    <div className={`px-3 py-2 rounded border ${LEVEL_BG[vitality.level] || 'bg-gray-50 border-gray-200'} space-y-1.5`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Execution Vitality</span>
        <span className={`text-[11px] font-semibold ${LEVEL_COLORS[vitality.level] ? 'text-gray-700' : 'text-gray-400'}`}>
          {vitality.overall}
        </span>
      </div>
      <VitalityMeter label="coordination" value={vitality.coordination} />
      <VitalityMeter label="momentum" value={vitality.momentum} />
      <VitalityMeter label="participation" value={vitality.participation} />
      <VitalityMeter label="stability" value={vitality.stability} />
    </div>
  );
}
