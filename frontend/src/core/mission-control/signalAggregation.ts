import type { AttentionSignal } from '../dashboard/operationalAttention';
import { sortByAttention, shouldShowOnDashboard } from '../dashboard/operationalAttention';

export interface AggregatedSignal {
  critical: AttentionSignal[];
  important: AttentionSignal[];
  informational: AttentionSignal[];
}

export function aggregateSignals(signals: AttentionSignal[]): AggregatedSignal {
  const visible = signals.filter(shouldShowOnDashboard);
  const sorted = sortByAttention(visible);

  return {
    critical: sorted.filter(s => s.level === 'critical'),
    important: sorted.filter(s => s.level === 'important'),
    informational: sorted.filter(s => s.level === 'informational'),
  };
}

export const MAX_VISIBLE_SIGNALS = {
  critical: 5,
  important: 4,
  informational: 3,
};

export function truncateAggregated(
  aggregated: AggregatedSignal
): AggregatedSignal {
  return {
    critical: aggregated.critical.slice(0, MAX_VISIBLE_SIGNALS.critical),
    important: aggregated.important.slice(0, MAX_VISIBLE_SIGNALS.important),
    informational: aggregated.informational.slice(0, MAX_VISIBLE_SIGNALS.informational),
  };
}
