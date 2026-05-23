import type { CollaborationSignal, ActivityEntry } from '../presence/types';
import type { VitalityScore } from '../coordination/types';
import type { Prediction } from './types';

export function forecastCoordination(
  signals: CollaborationSignal[],
  feed: ActivityEntry[],
  vitality: VitalityScore,
): Prediction[] {
  const predictions: Prediction[] = [];
  const now = Date.now();

  const recentFeed = feed.filter(f => now - new Date(f.timestamp).getTime() < 600_000);
  const recentSignals = signals.filter(s => now - new Date(s.timestamp).getTime() < 600_000);

  const blockerCount = recentSignals.filter(s => s.type === 'blocker').length;
  const reviewCount = recentSignals.filter(s => s.type === 'reviewing').length;
  const editCount = recentSignals.filter(s => s.type === 'editing').length;
  const statusChanges = recentFeed.filter(f => f.action === 'task_status_changed').length;

  if (blockerCount >= 2 && reviewCount < 2) {
    predictions.push({
      id: `pred-blocker-${now}`,
      type: 'blocker_risk',
      probability: Math.min(0.85, 0.4 + blockerCount * 0.15),
      timeframe: 'next 2 hours',
      title: 'Blocker escalation possible',
      description: `${blockerCount} blocker discussions with limited review activity — blockers may escalate if unaddressed`,
      timestamp: new Date(now).toISOString(),
    });
  }

  if (editCount > 0 && reviewCount === 0 && statusChanges >= 2) {
    predictions.push({
      id: `pred-delay-${now}`,
      type: 'delay_risk',
      probability: Math.min(0.7, 0.3 + statusChanges * 0.1),
      timeframe: 'next 4 hours',
      title: 'Review-backed delivery risk',
      description: `${statusChanges} status changes without review activity — delivery may slow without coordination`,
      timestamp: new Date(now).toISOString(),
    });
  }

  if (vitality.momentum < 40 && vitality.stability < 50) {
    predictions.push({
      id: `pred-stagnation-${now}`,
      type: 'sprint_instability',
      probability: Math.min(0.8, (1 - vitality.momentum / 100) * 0.6 + (1 - vitality.stability / 100) * 0.4),
      timeframe: 'next 24 hours',
      title: 'Sprint stagnation risk',
      description: `Low momentum (${vitality.momentum}/100) and stability (${vitality.stability}/100) — sprint progress may stall`,
      timestamp: new Date(now).toISOString(),
    });
  }

  return predictions;
}
