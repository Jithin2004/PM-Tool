import type { CollaborationSignal, ActivityEntry, OperationalPresence } from '../presence/types';
import type { Prediction } from './types';

export function predictOverload(
  presences: OperationalPresence[],
  signals: CollaborationSignal[],
  feed: ActivityEntry[],
): Prediction[] {
  const predictions: Prediction[] = [];
  const now = Date.now();

  const recentFeed = feed.filter(f => now - new Date(f.timestamp).getTime() < 600_000);
  const recentSignals = signals.filter(s => now - new Date(s.timestamp).getTime() < 600_000);

  const userActivityCount = new Map<string, number>();
  for (const s of recentSignals) {
    userActivityCount.set(s.userId, (userActivityCount.get(s.userId) || 0) + 1);
  }

  const activeUsers = presences.filter(p => !p.idle && p.state !== 'away');

  for (const user of activeUsers) {
    const activityCount = userActivityCount.get(user.userId) || 0;
    const assignActions = recentFeed.filter(
      f => f.action === 'task_assigned' && f.userId === user.userId,
    ).length;

    if (activityCount > 10 || assignActions >= 3) {
      const overloadProb = Math.min(0.8, 0.3 + (activityCount / 20) + (assignActions / 5));

      predictions.push({
        id: `overload-${user.userId}-${now}`,
        type: 'overload',
        probability: overloadProb,
        timeframe: 'next 2 hours',
        title: `${user.username} showing elevated activity`,
        description: assignActions >= 3
          ? `${activityCount} interactions and ${assignActions} new assignments — workload may be concentrating`
          : `High interaction volume (${activityCount}) — potential overload risk`,
        context: { userId: user.userId },
        timestamp: new Date(now).toISOString(),
      });
    }
  }

  return predictions;
}
