export type AttentionLevel = 'critical' | 'important' | 'informational' | 'background';

export interface AttentionSignal {
  id: string;
  level: AttentionLevel;
  source: string;
  message: string;
  priority: number;
}

const ATTENTION_WEIGHTS: Record<AttentionLevel, number> = {
  critical: 100,
  important: 60,
  informational: 30,
  background: 10,
};

export function calculateAttentionWeight(level: AttentionLevel): number {
  return ATTENTION_WEIGHTS[level];
}

export function sortByAttention(items: AttentionSignal[]): AttentionSignal[] {
  return [...items].sort((a, b) => {
    const wa = calculateAttentionWeight(a.level);
    const wb = calculateAttentionWeight(b.level);
    if (wa !== wb) return wb - wa;
    return b.priority - a.priority;
  });
}

export function shouldShowOnDashboard(signal: AttentionSignal): boolean {
  return signal.level !== 'background';
}
