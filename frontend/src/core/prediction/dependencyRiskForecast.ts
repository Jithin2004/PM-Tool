import type { CollaborationSignal, ActivityEntry } from '../presence/types';
import type { Prediction } from './types';

export function forecastDependencyRisk(
  signals: CollaborationSignal[],
  feed: ActivityEntry[],
): Prediction[] {
  const predictions: Prediction[] = [];
  const now = Date.now();

  const recentFeed = feed.filter(f => now - new Date(f.timestamp).getTime() < 600_000);
  const recentSignals = signals.filter(s => now - new Date(s.timestamp).getTime() < 600_000);

  const dependencyEdits = recentFeed.filter(f => f.action === 'dependency_added' || f.action === 'dependency_removed').length;
  const blockerCount = recentSignals.filter(s => s.type === 'blocker').length;
  const epicActivity = recentSignals.filter(s => !!s.context.epicId).length;

  if (dependencyEdits >= 3) {
    predictions.push({
      id: `dep-risk-${now}`,
      type: 'dependency_escalation',
      probability: Math.min(0.75, 0.3 + dependencyEdits * 0.1),
      timeframe: 'next 4 hours',
      title: 'Dependency coordination active',
      description: `${dependencyEdits} dependency changes detected — coordination pressure may increase around affected epics`,
      timestamp: new Date(now).toISOString(),
    });
  }

  if (epicActivity > 5 && blockerCount >= 2) {
    predictions.push({
      id: `dep-blocker-${now}`,
      type: 'dependency_escalation',
      probability: Math.min(0.85, 0.4 + (epicActivity / 10) + (blockerCount * 0.1)),
      timeframe: 'next 2 hours',
      title: 'Epic coordination under pressure',
      description: `High epic activity (${epicActivity} signals) with ${blockerCount} blockers — dependency chain may be strained`,
      timestamp: new Date(now).toISOString(),
    });
  }

  return predictions;
}
