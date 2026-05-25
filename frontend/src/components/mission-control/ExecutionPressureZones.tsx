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
      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">pressure zones</div>

      {vitality.stability < 50 && (
        <div className="px-2 py-1.5 bg-amber-50 border border-border rounded">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-amber-700">stability</span>
            <span className="text-[10px] font-mono text-amber-600">{vitality.stability}</span>
          </div>
          <p className="text-[9px] text-amber-600 mt-0.5">
            {vitality.stability < 30 ? 'Elevated blocker or reassignment activity' : 'Moderate stability pressure'}
          </p>
        </div>
      )}

      {activeBottlenecks.slice(0, 3).map(b => (
        <div
          key={b.id}
          className={`px-2 py-1.5 rounded border ${
            b.severity === 'critical'
              ? 'bg-red-50 border-red-100'
              : 'bg-amber-50 border-border'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-gray-700">{b.title}</span>
            <span className="text-[10px] font-mono text-gray-500">{b.impact}</span>
          </div>
          <p className="text-[9px] text-gray-500 mt-0.5">{b.description}</p>
        </div>
      ))}
    </div>
  );
}
