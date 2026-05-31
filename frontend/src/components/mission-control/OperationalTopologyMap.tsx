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
      <div className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">operational topology</div>

      <div className="space-y-1.5">
        {sections.map(s => {
          const maxCount = sections[0]?.count || 1;
          const pct = (s.count / maxCount) * 100;
          let barColor = 'bg-accent-primary opacity-60';
          if (pct > 66) barColor = 'bg-accent-primary opacity-100';
          else if (pct > 33) barColor = 'bg-accent-primary opacity-80';

          return (
            <div key={s.section} className="flex items-center gap-2">
              <span className="text-[10px] text-text-tertiary w-16 shrink-0">{s.label}</span>
              <div className="flex-1 h-4 bg-white/5 rounded-sm relative overflow-hidden">
                <div className={`h-full rounded-sm ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] font-mono-pm text-text-tertiary w-4 text-right">{s.count}</span>
              {s.activity > 0 && (
                <span className="text-[9px] text-text-secondary w-8">{s.activity}s</span>
              )}
            </div>
          );
        })}
      </div>

      {hotspots.length > 0 && (
        <div className="pt-1 border-t border-gray-200 dark:border-white/10">
          <div className="text-[9px] text-text-secondary uppercase tracking-wider mb-1">hotspots</div>
          {hotspots.slice(0, 3).map(h => {
            let dotColor = 'bg-signal-warning';
            if (h.intensity >= 70) dotColor = 'bg-signal-critical';
            else if (h.intensity >= 40) dotColor = 'bg-signal-warning';
            else dotColor = 'bg-signal-info';

            return (
              <div key={h.id} className="flex items-center gap-1.5 py-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                <span className="text-[10px] text-text-tertiary">{h.label}</span>
                <span className="text-[9px] text-text-secondary ml-auto">{h.intensity}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
