import type { CollaborationSignal, ActivityEntry } from '../presence/types';
import type { OperationalPattern } from './types';

export function detectCoordinationBursts(
  signals: CollaborationSignal[],
  windowMs: number = 300_000,
): OperationalPattern[] {
  const patterns: OperationalPattern[] = [];
  const now = Date.now();
  const recent = signals.filter(s => now - new Date(s.timestamp).getTime() < windowMs);

  if (recent.length >= 5) {
    const uniqueUsers = new Set(recent.map(s => s.userId)).size;
    if (uniqueUsers >= 3) {
      const editing = recent.filter(s => s.type === 'editing').length;
      patterns.push({
        id: `burst-${now}`,
        type: 'coordination_burst',
        severity: editing >= 3 ? 'critical' : 'warning',
        title: 'Elevated coordination activity',
        description: `${uniqueUsers} contributors active in the same window with ${editing} editing`,
        context: {},
        timestamp: new Date(now).toISOString(),
        metadata: { activeUsers: uniqueUsers, editsInWindow: editing },
      });
    }
  }

  return patterns;
}

export function detectReviewGaps(
  signals: CollaborationSignal[],
  feed: ActivityEntry[],
  windowMs: number = 600_000,
): OperationalPattern[] {
  const patterns: OperationalPattern[] = [];
  const now = Date.now();
  const recentWindow = now - windowMs;

  const statusChanges = feed.filter(
    f => f.action === 'task_status_changed' && new Date(f.timestamp).getTime() > recentWindow,
  );
  const reviewActions = feed.filter(
    f => (f.action === 'review_completed' || f.action === 'approval_granted') && new Date(f.timestamp).getTime() > recentWindow,
  );

  if (statusChanges.length >= 3 && reviewActions.length === 0) {
    patterns.push({
      id: `review-gap-${now}`,
      type: 'review_gap',
      severity: 'warning',
      title: 'No review activity detected',
      description: `${statusChanges.length} status changes with no reviews completed`,
      context: {},
      timestamp: new Date(now).toISOString(),
      metadata: { statusChanges: statusChanges.length },
    });
  }

  return patterns;
}

export function detectWorkloadConcentration(
  signals: CollaborationSignal[],
  feed: ActivityEntry[],
): OperationalPattern[] {
  const patterns: OperationalPattern[] = [];
  const now = Date.now();

  const assignActions = feed.filter(f => f.action === 'task_assigned');
  const assignCounts = new Map<string, number>();
  for (const a of assignActions) {
    assignCounts.set(a.userId, (assignCounts.get(a.userId) || 0) + 1);
  }

  if (assignCounts.size > 0) {
    const maxAssigns = Math.max(...assignCounts.values());
    const totalAssigns = assignActions.length;
    if (maxAssigns > 0 && totalAssigns > 0 && maxAssigns / totalAssigns > 0.5 && totalAssigns >= 3) {
      const concentratedUser = [...assignCounts.entries()].find(([, c]) => c === maxAssigns)?.[0];
      patterns.push({
        id: `concentration-${now}`,
        type: 'workload_concentration',
        severity: 'warning',
        title: 'Workload concentrated',
        description: `${maxAssigns} of ${totalAssigns} assignments went to a single contributor`,
        context: { userId: concentratedUser },
        timestamp: new Date(now).toISOString(),
        metadata: { maxAssigns, totalAssigns, concentrationRatio: maxAssigns / totalAssigns },
      });
    }
  }

  return patterns;
}
