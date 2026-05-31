import type { OperationalState } from '../../core/presence/types';

const STATE_COLORS: Record<OperationalState, string> = {
  active: 'bg-green-500',
  idle: 'bg-yellow-400',
  away: 'bg-surface-highest',
  reviewing: 'bg-blue-500',
  editing: 'bg-emerald-500',
  planning: 'bg-purple-500',
  in_sprint: 'bg-indigo-500',
  in_backlog: 'bg-amber-500',
  in_timeline: 'bg-cyan-500',
  in_board: 'bg-sky-500',
  in_analytics: 'bg-pink-500',
};

interface PresenceIndicatorProps {
  state: OperationalState;
  className?: string;
}

export function PresenceIndicator({ state, className = '' }: PresenceIndicatorProps) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${STATE_COLORS[state] || 'bg-[var(--pm-surface)]'} ${className}`}
      title={state.replace(/_/g, ' ')}
    />
  );
}
