import type { CollaborationSignal, OperationalPresence } from '../../core/presence/types';
import { PresenceIndicator } from './PresenceIndicator';
import { describeOperationalState } from '../../core/presence/operationalPresence';
import { describeIntent } from '../../core/presence/operationalIntent';

interface ContextPresenceBarProps {
  presences: OperationalPresence[];
  signals: CollaborationSignal[];
  summary: { total: number; editing: number; reviewing: number; planning: number; blocked: number };
}

export function ContextPresenceBar({ presences, signals, summary }: ContextPresenceBarProps) {
  if (presences.length === 0) return null;

  const activePresences = presences.filter(p => !p.idle);

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-text-tertiary border-b border-border">
      <span className="font-medium text-[var(--pm-text-secondary)]">
        {summary.total} active
      </span>
      {summary.editing > 0 && <span>{summary.editing} editing</span>}
      {summary.reviewing > 0 && <span>{summary.reviewing} reviewing</span>}
      {summary.planning > 0 && <span>{summary.planning} planning</span>}
      {summary.blocked > 0 && <span className="text-amber-600">{summary.blocked} blocked</span>}
      <div className="flex items-center ml-auto gap-2">
        {activePresences.slice(0, 6).map(p => (
          <div key={p.userId} className="flex items-center gap-1" title={`${p.username} — ${describeIntent(p.intent)}`}>
            <PresenceIndicator state={p.state} />
            <span className="max-w-[80px] truncate">{p.username}</span>
          </div>
        ))}
        {activePresences.length > 6 && (
          <span className="text-[var(--pm-text-secondary)] dark:text-[var(--pm-text-secondary)]">+{activePresences.length - 6}</span>
        )}
      </div>
    </div>
  );
}
