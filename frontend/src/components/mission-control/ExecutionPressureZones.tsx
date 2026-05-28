import type { Bottleneck, ExecutionHotspot, VitalityScore } from '../../core/coordination/types';

interface ExecutionPressureZonesProps {
  bottlenecks: Bottleneck[];
  hotspots: ExecutionHotspot[];
  vitality: VitalityScore;
}

export function ExecutionPressureZones({ bottlenecks, hotspots, vitality }: ExecutionPressureZonesProps) {
  const activeBottlenecks = bottlenecks.filter(b => b.severity === 'critical' || b.severity === 'warning');
  const hasPressure = vitality.stability < 50 || activeBottlenecks.length > 0 || hotspots.length > 0;

  if (!hasPressure) return null;

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">pressure zones</div>

      {vitality.stability < 50 && (
        <div className="px-2 py-1.5 bg-signal-warning/10 border border-signal-warning/20 rounded">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-signal-warning">stability</span>
            <span className="text-[10px] font-mono-pm text-signal-warning">{vitality.stability}</span>
          </div>
          <p className="text-[9px] text-signal-warning mt-0.5">
            {vitality.stability < 30 ? 'Elevated blocker or reassignment activity' : 'Moderate stability pressure'}
          </p>
        </div>
      )}

      {activeBottlenecks.slice(0, 3).map(b => (
        <div
          key={b.id}
          className={`px-2 py-1.5 rounded border ${
            b.severity === 'critical'
              ? 'bg-signal-critical/10 border-signal-critical/20'
              : 'bg-signal-warning/10 border-signal-warning/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-text-primary">{b.title}</span>
            <span className="text-[10px] font-mono-pm text-text-tertiary">{b.impact}</span>
          </div>
          <p className="text-[9px] text-text-tertiary mt-0.5">{b.description}</p>
        </div>
      ))}
    </div>
  );
}
