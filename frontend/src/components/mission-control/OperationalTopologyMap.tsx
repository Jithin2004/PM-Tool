import type { OperationalPresence, CollaborationSignal } from '../../core/presence/types';
import type { ExecutionHotspot } from '../../core/coordination/types';

interface OperationalTopologyMapProps {
  presences: OperationalPresence[];
  signals: CollaborationSignal[];
  hotspots: ExecutionHotspot[];
}

const SECTION_LABELS: Record<string, string> = {
  backlog: 'backlog',
  board: 'board',
  sprints: 'sprints',
  timeline: 'timeline',
  workspace: 'workspace',
};

export function OperationalTopologyMap({ presences, signals, hotspots }: OperationalTopologyMapProps) {
  const activePresences = presences.filter(p => !p.idle && p.state !== 'away');

  const sectionCounts = new Map<string, number>();
  for (const p of activePresences) {
    const section = p.context.section;
    sectionCounts.set(section, (sectionCounts.get(section) || 0) + 1);
  }

  const sections = [...sectionCounts.entries()]
    .map(([section, count]) => ({
      section,
      label: SECTION_LABELS[section] || section,
      count,
      activity: signals.filter(s => s.context.section === section).length,
    }))
    .sort((a, b) => b.count - a.count);

  if (sections.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">operational topology</div>

      <div className="space-y-1.5">
        {sections.map(s => {
          const maxCount = sections[0]?.count || 1;
          const pct = (s.count / maxCount) * 100;
          let barColor = 'bg-indigo-200';
          if (pct > 66) barColor = 'bg-indigo-300';
          else if (pct > 33) barColor = 'bg-indigo-100';

          return (
            <div key={s.section} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-16 shrink-0">{s.label}</span>
              <div className="flex-1 h-4 bg-gray-50 rounded-sm relative overflow-hidden">
                <div className={`h-full rounded-sm ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] font-mono text-gray-500 w-4 text-right">{s.count}</span>
              {s.activity > 0 && (
                <span className="text-[9px] text-gray-400 w-8">{s.activity}s</span>
              )}
            </div>
          );
        })}
      </div>

      {hotspots.length > 0 && (
        <div className="pt-1 border-t border-gray-100">
          <div className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">hotspots</div>
          {hotspots.slice(0, 3).map(h => {
            let dotColor = 'bg-amber-200';
            if (h.intensity >= 70) dotColor = 'bg-red-300';
            else if (h.intensity >= 40) dotColor = 'bg-amber-300';
            else dotColor = 'bg-blue-200';

            return (
              <div key={h.id} className="flex items-center gap-1.5 py-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                <span className="text-[10px] text-gray-500">{h.label}</span>
                <span className="text-[9px] text-gray-400 ml-auto">{h.intensity}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
