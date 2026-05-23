import type { ExecutionHotspot as ExecutionHotspotType } from '../../core/coordination/types';

interface ExecutionHotspotsProps {
  hotspots: ExecutionHotspotType[];
  maxItems?: number;
}

function HotspotBar({ intensity }: { intensity: number }) {
  let color = 'bg-gray-200';
  if (intensity >= 70) color = 'bg-red-300';
  else if (intensity >= 40) color = 'bg-amber-300';
  else color = 'bg-blue-300';

  return (
    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, intensity)}%` }} />
    </div>
  );
}

export function ExecutionHotspots({ hotspots, maxItems = 5 }: ExecutionHotspotsProps) {
  if (hotspots.length === 0) return null;

  const sorted = [...hotspots].sort((a, b) => b.intensity - a.intensity).slice(0, maxItems);

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold pb-1 border-b border-gray-100">
        execution hotspots
      </div>
      {sorted.map(h => (
        <div key={h.id} className="flex items-center gap-2 px-1">
          <span className="text-[10px] text-gray-500 w-2 font-mono">{h.intensity}</span>
          <HotspotBar intensity={h.intensity} />
          <span className="text-[10px] text-gray-600 truncate min-w-0 flex-1">{h.label}</span>
          <span className="text-[9px] text-gray-400 shrink-0">{h.description}</span>
        </div>
      ))}
    </div>
  );
}
