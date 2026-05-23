import type { OperationalPresence, CollaborationSignal, ActivityEntry } from '../../core/presence/types';

interface OrganizationalFlowMapProps {
  presences: OperationalPresence[];
  signals: CollaborationSignal[];
  feed: ActivityEntry[];
}

export function OrganizationalFlowMap({ presences, signals, feed }: OrganizationalFlowMapProps) {
  const activePresences = presences.filter(p => !p.idle && p.state !== 'away');

  const now = Date.now();
  const recentFeed = feed.filter(f => now - new Date(f.timestamp).getTime() < 600_000);

  const actionTypes = new Map<string, number>();
  for (const f of recentFeed) {
    const baseAction = f.action.split('_')[0];
    actionTypes.set(baseAction, (actionTypes.get(baseAction) || 0) + 1);
  }

  const flowItems = [...actionTypes.entries()]
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count);

  if (flowItems.length === 0 && activePresences.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">execution flow</div>

      {activePresences.length > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-green-300" />
          {activePresences.length} active contributor{activePresences.length !== 1 ? 's' : ''}
        </div>
      )}

      <div className="space-y-0.5">
        {flowItems.slice(0, 5).map(item => {
          const maxCount = flowItems[0]?.count || 1;
          const pct = (item.count / maxCount) * 100;

          return (
            <div key={item.action} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-20 shrink-0 capitalize">{item.action}</span>
              <div className="flex-1 h-3 bg-gray-50 rounded-sm overflow-hidden">
                <div className="h-full bg-indigo-100 rounded-sm" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] font-mono text-gray-500 w-4 text-right">{item.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
