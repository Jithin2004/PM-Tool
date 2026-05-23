import type { VitalityScore } from './types';
import type { CollaborationSignal, ActivityEntry, OperationalPresence } from '../presence/types';

export function calculateVitality(
  presences: OperationalPresence[],
  signals: CollaborationSignal[],
  feed: ActivityEntry[],
): VitalityScore {
  const activePresences = presences.filter(p => !p.idle && p.state !== 'away');
  const activeCount = activePresences.length;

  const now = Date.now();
  const windowMs = 600_000;
  const recentSignals = signals.filter(s => now - new Date(s.timestamp).getTime() < windowMs);
  const recentFeed = feed.filter(f => now - new Date(f.timestamp).getTime() < windowMs);

  // Coordination vitality: variety of intents and presence count
  const uniqueIntents = new Set(activePresences.map(p => p.intent)).size;
  const maxIntents = 8;
  const coordination = Math.min(100, Math.round((activeCount * 10) + (uniqueIntents / maxIntents) * 40));

  // Momentum: rate of meaningful actions
  const editActions = recentFeed.filter(f =>
    f.action.startsWith('task_') || f.action.startsWith('sprint_') || f.action.startsWith('epic_'),
  ).length;
  const momentum = Math.min(100, Math.round((editActions / 6) * 100));

  // Participation: balance across users
  const uniqueUsers = new Set(recentSignals.map(s => s.userId)).size;
  const participationRatio = activeCount > 0 ? uniqueUsers / activeCount : 0;
  const participation = Math.min(100, Math.round(participationRatio * 100));

  // Stability: low conflict, low reassignment
  const blockerCount = recentSignals.filter(s => s.type === 'blocker').length;
  const reassignCount = recentFeed.filter(f => f.action === 'task_assigned').length;
  const stability = Math.max(0, 100 - (blockerCount * 15) - (reassignCount * 10));

  const overall = Math.round((coordination * 0.3) + (momentum * 0.3) + (participation * 0.2) + (stability * 0.2));

  let level: VitalityScore['level'] = 'moderate';
  if (overall >= 75) level = 'strong';
  else if (overall >= 50) level = 'healthy';
  else if (overall >= 25) level = 'moderate';
  else level = 'low';

  return { overall, coordination, momentum, participation, stability, level };
}
