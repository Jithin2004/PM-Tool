import type { ActivityEntry, CollaborationSignal } from '../../core/presence/types';
import { PresenceIndicator } from './PresenceIndicator';
import { describeIntent } from '../../core/presence/operationalIntent';

interface OperationalActivityFeedProps {
  feed: ActivityEntry[];
  signals: CollaborationSignal[];
  maxItems?: number;
}

interface MergedItem {
  id: string;
  userId: string;
  username: string;
  intent: string;
  description: string;
  timestamp: string;
  state: import('../../core/presence/types').OperationalState;
}

export function OperationalActivityFeed({ feed, signals, maxItems = 10 }: OperationalActivityFeedProps) {
  const merged: MergedItem[] = [
    ...signals.map(s => ({
      id: `signal-${s.userId}-${s.timestamp}`,
      userId: s.userId,
      username: s.username,
      state: s.type === 'editing' ? 'editing' as const : s.type === 'reviewing' ? 'reviewing' as const : 'active' as const,
      intent: s.intent,
      description: `${s.username} is ${describeIntent(s.intent)}`,
      timestamp: s.timestamp,
    })),
    ...feed.map(f => ({
      id: f.id,
      userId: f.userId,
      username: f.username,
      state: f.operationalState,
      intent: f.intent,
      description: f.description,
      timestamp: f.timestamp,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, maxItems);

  if (merged.length === 0) return null;

  return (
    <div className="text-xs text-text-tertiary space-y-1">
      {merged.map(item => (
        <div key={item.id} className="flex items-start gap-2 py-1">
          <PresenceIndicator state={item.state} className="mt-1 shrink-0" />
          <div className="min-w-0">
            <span className="text-gray-700 font-medium">{item.username}</span>
            {item.description.replace(item.username, '')}
          </div>
        </div>
      ))}
    </div>
  );
}
