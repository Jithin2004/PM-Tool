import type { CollaborationSignal, ActivityEntry } from '../presence/types';
import type { VitalityScore } from '../coordination/types';
import type { Prediction } from './types';

export function predictSprintInstability(
  signals: CollaborationSignal[],
  feed: ActivityEntry[],
  vitality: VitalityScore,
): Prediction[] {
  const predictions: Prediction[] = [];
  const now = Date.now();

  const recentFeed = feed.filter(f => now - new Date(f.timestamp).getTime() < 600_000);
  const recentSignals = signals.filter(s => now - new Date(s.timestamp).getTime() < 600_000);

  const reassignCount = recentFeed.filter(f => f.action === 'task_assigned').length;
  const blockerCount = recentSignals.filter(s => s.type === 'blocker').length;
  const editCount = recentSignals.filter(s => s.type === 'editing').length;

  let instabilityScore = 0;

  if (reassignCount >= 3) instabilityScore += 0.3;
  if (blockerCount >= 2) instabilityScore += 0.25;
  if (editCount === 0 && vitality.momentum < 30) instabilityScore += 0.2;
  if (vitality.stability < 40) instabilityScore += 0.15;
  if (vitality.participation < 25) instabilityScore += 0.1;

  if (instabilityScore > 0.4) {
    predictions.push({
      id: `instability-${now}`,
      type: 'sprint_instability',
      probability: Math.min(0.9, instabilityScore),
      timeframe: 'next 24 hours',
      title: 'Sprint instability detected',
      description: reassignCount >= 3
        ? `High reassignment (${reassignCount}) combined with ${blockerCount} blockers may destabilize sprint`
        : `Multiple instability signals (reassignments: ${reassignCount}, blockers: ${blockerCount}, momentum: ${vitality.momentum})`,
      timestamp: new Date(now).toISOString(),
    });
  }

  return predictions;
}
