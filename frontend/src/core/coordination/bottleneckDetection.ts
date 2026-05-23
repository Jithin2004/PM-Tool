import type { CollaborationSignal, ActivityEntry, OperationalPresence } from '../presence/types';
import type { Bottleneck, ExecutionHotspot } from './types';

export function detectBottlenecks(
  presences: OperationalPresence[],
  signals: CollaborationSignal[],
  feed: ActivityEntry[],
): Bottleneck[] {
  const bottlenecks: Bottleneck[] = [];
  const now = Date.now();
  const windowMs = 600_000;

  const recentFeed = feed.filter(f => now - new Date(f.timestamp).getTime() < windowMs);
  const recentSignals = signals.filter(s => now - new Date(s.timestamp).getTime() < windowMs);

  // Blocker concentration
  const blockerSignals = recentSignals.filter(s => s.type === 'blocker');
  if (blockerSignals.length >= 2) {
    bottlenecks.push({
      id: `blocker-conc-${now}`,
      type: 'blocker_concentration',
      severity: blockerSignals.length >= 4 ? 'critical' : 'warning',
      title: 'Blocker concentration detected',
      description: `${blockerSignals.length} blocker discussions in the last 10 minutes`,
      context: {},
      impact: Math.min(100, blockerSignals.length * 25),
      timestamp: new Date(now).toISOString(),
    });
  }

  // Review bottleneck
  const statusChanges = recentFeed.filter(f => f.action === 'task_status_changed').length;
  const reviewActions = recentFeed.filter(f => f.action === 'review_completed' || f.action === 'approval_granted').length;
  if (statusChanges >= 5 && reviewActions === 0) {
    bottlenecks.push({
      id: `review-bn-${now}`,
      type: 'review_bottleneck',
      severity: 'warning',
      title: 'Review bottleneck forming',
      description: `${statusChanges} status changes with no completed reviews`,
      context: {},
      impact: Math.min(100, statusChanges * 10),
      timestamp: new Date(now).toISOString(),
    });
  }

  // Excessive reassignment
  const reassignments = recentFeed.filter(f => f.action === 'task_assigned').length;
  if (reassignments >= 4) {
    bottlenecks.push({
      id: `reassign-${now}`,
      type: 'excessive_reassignment',
      severity: 'warning',
      title: 'Elevated reassignment activity',
      description: `${reassignments} task reassignments in the last 10 minutes`,
      context: {},
      impact: Math.min(100, reassignments * 15),
      timestamp: new Date(now).toISOString(),
    });
  }

  return bottlenecks;
}

export function detectHotspots(
  presences: OperationalPresence[],
  signals: CollaborationSignal[],
): ExecutionHotspot[] {
  const hotspots: ExecutionHotspot[] = [];
  const now = Date.now();

  const epicContexts = new Map<string, { count: number; users: Set<string> }>();
  const taskContexts = new Map<string, { count: number; users: Set<string> }>();

  for (const p of presences) {
    if (p.idle || p.state === 'away') continue;

    if (p.context.epicId) {
      const existing = epicContexts.get(p.context.epicId) || { count: 0, users: new Set() };
      existing.count++;
      existing.users.add(p.userId);
      epicContexts.set(p.context.epicId, existing);
    }
  }

  for (const [epicId, data] of epicContexts) {
    if (data.count >= 2) {
      hotspots.push({
        id: `hotspot-epic-${epicId}-${now}`,
        label: `Epic ${epicId.slice(0, 8)}`,
        intensity: Math.min(100, data.count * 20),
        type: 'epic',
        description: `${data.users.size} contributor(s) active in epic`,
        context: { id: epicId },
      });
    }
  }

  return hotspots;
}
