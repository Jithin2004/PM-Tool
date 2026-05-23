import type { CollaborationSignal, ActivityEntry, OperationalPresence } from '../presence/types';
import type { CoordinationDensity } from './types';
import { resolveIntent } from '../presence/operationalIntent';
import type { IntentSignal } from '../presence/types';

export function calculateCoordinationDensity(
  presences: OperationalPresence[],
  signals: CollaborationSignal[],
  feed: ActivityEntry[],
): CoordinationDensity {
  const activePresences = presences.filter(p => !p.idle && p.state !== 'away');
  const totalActive = activePresences.length;

  const uniqueIntents = new Set(activePresences.map(p => p.intent)).size;

  const now = Date.now();
  const recentSignals = signals.filter(s => now - new Date(s.timestamp).getTime() < 300_000);
  const recentFeed = feed.filter(f => now - new Date(f.timestamp).getTime() < 300_000);

  const editingCount = recentSignals.filter(s => s.type === 'editing').length;
  const blockerCount = recentSignals.filter(s => s.type === 'blocker').length;
  const changeCount = recentFeed.filter(f => f.action.startsWith('task_') || f.action.startsWith('sprint_')).length;

  const conflictScore = Math.min(100, (editingCount * 10) + (blockerCount * 20) + (changeCount * 5));

  let collaborationIntensity: CoordinationDensity['collaborationIntensity'] = 'low';
  if (conflictScore > 60) collaborationIntensity = 'very_high';
  else if (conflictScore > 40) collaborationIntensity = 'high';
  else if (conflictScore > 20) collaborationIntensity = 'moderate';

  const intentSignals: IntentSignal[] = activePresences.map(p => ({
    intent: p.intent,
    source: 'route' as const,
    confidence: 1,
  }));
  const dominantIntent = resolveIntent(intentSignals);

  return {
    totalActive,
    uniqueIntents,
    conflictScore,
    collaborationIntensity,
    dominantIntent,
  };
}

export function analyzeParticipation(
  signals: CollaborationSignal[],
  feed: ActivityEntry[],
): Map<string, { total: number; editing: number; reviewing: number; planning: number; blocked: number }> {
  const participation = new Map<string, { total: number; editing: number; reviewing: number; planning: number; blocked: number }>();

  for (const s of signals) {
    const p = participation.get(s.userId) || { total: 0, editing: 0, reviewing: 0, planning: 0, blocked: 0 };
    p.total++;
    if (s.type === 'editing') p.editing++;
    else if (s.type === 'reviewing') p.reviewing++;
    else if (s.type === 'planning') p.planning++;
    else if (s.type === 'blocker') p.blocked++;
    participation.set(s.userId, p);
  }

  return participation;
}
