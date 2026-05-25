import type { OperationalPattern, Bottleneck, CoordinationDensity } from '../../core/coordination/types';

interface CoordinationInsightsPanelProps {
  density: CoordinationDensity;
  patterns: OperationalPattern[];
  bottlenecks: Bottleneck[];
  maxItems?: number;
}

const SEVERITY_ICON: Record<string, string> = {
  info: '○',
  warning: '△',
  critical: '▲',
};

const SEVERITY_COLOR: Record<string, string> = {
  info: 'text-gray-500',
  warning: 'text-amber-600',
  critical: 'text-red-600',
};

export function CoordinationInsightsPanel({ density, patterns, bottlenecks, maxItems = 5 }: CoordinationInsightsPanelProps) {
  const items = [
    ...patterns.map(p => ({ type: 'pattern' as const, severity: p.severity, title: p.title, description: p.description, id: p.id })),
    ...bottlenecks.map(b => ({ type: 'bottleneck' as const, severity: b.severity, title: b.title, description: b.description, id: b.id })),
  ].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  }).slice(0, maxItems);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 px-1 text-[10px] text-gray-400 uppercase tracking-wider font-semibold pb-1 border-b border-gray-100">
        <span>coordination</span>
        <span className={density.collaborationIntensity === 'very_high' || density.collaborationIntensity === 'high' ? 'text-signal-warning' : ''}>
          {density.totalActive} active · {density.collaborationIntensity}
        </span>
      </div>

      {items.length === 0 && (
        <p className="text-[11px] text-gray-400 px-1 py-2">No coordination patterns detected</p>
      )}

      {items.map(item => (
        <div key={item.id} className="px-1 py-1.5 border-b border-gray-50 last:border-b-0">
          <div className="flex items-start gap-2">
            <span className={`text-[10px] mt-0.5 ${SEVERITY_COLOR[item.severity]}`}>
              {SEVERITY_ICON[item.severity]}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-gray-700">{item.title}</p>
              <p className="text-[10px] text-gray-400">{item.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
