import type { VitalityScore } from '../../core/coordination/types';

interface VitalityOverviewProps {
  vitality: VitalityScore;
}

const LEVEL_LABELS: Record<string, { label: string; color: string; bar: string }> = {
  strong: { label: 'strong', color: 'text-signal-safe', bar: 'bg-signal-safe' },
  healthy: { label: 'healthy', color: 'text-signal-safe', bar: 'bg-signal-safe' },
  moderate: { label: 'moderate', color: 'text-signal-warning', bar: 'bg-signal-warning' },
  low: { label: 'low', color: 'text-signal-critical', bar: 'bg-signal-critical' },
};

function Meter({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, value);
  let barColor = 'bg-white/10';
  if (pct >= 70) barColor = 'bg-signal-safe';
  else if (pct >= 40) barColor = 'bg-signal-warning';
  else barColor = 'bg-signal-critical';

  return (
    <div>
      <div className="flex justify-between text-[10px] text-text-tertiary mb-0.5">
        <span>{label}</span>
        <span className="font-mono-pm">{value}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function VitalityOverview({ vitality }: VitalityOverviewProps) {
  const l = LEVEL_LABELS[vitality.level] || LEVEL_LABELS.moderate;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">execution vitality</span>
        <span className={`text-lg font-bold font-mono-pm ${l.color}`}>{vitality.overall}</span>
      </div>
      <span className={`text-[10px] ${l.color} capitalize`}>{l.label}</span>
      <div className="space-y-1.5 pt-1">
        <Meter label="coordination" value={vitality.coordination} />
        <Meter label="momentum" value={vitality.momentum} />
        <Meter label="participation" value={vitality.participation} />
        <Meter label="stability" value={vitality.stability} />
      </div>
    </div>
  );
}
