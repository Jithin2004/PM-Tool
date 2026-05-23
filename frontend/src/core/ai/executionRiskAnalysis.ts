import type { CollaborationSignal, ActivityEntry, OperationalPresence } from '../presence/types';
import type { VitalityScore, Bottleneck } from '../coordination/types';
import type { AiInsight } from './types';

export function analyzeExecutionRisks(
  presences: OperationalPresence[],
  signals: CollaborationSignal[],
  feed: ActivityEntry[],
  vitality: VitalityScore,
  bottlenecks: Bottleneck[],
): AiInsight[] {
  const insights: AiInsight[] = [];
  const now = new Date().toISOString();

  const recentFeed = feed.filter(f => Date.now() - new Date(f.timestamp).getTime() < 600_000);
  const recentSignals = signals.filter(s => Date.now() - new Date(s.timestamp).getTime() < 600_000);

  const statusChanges = recentFeed.filter(f => f.action === 'task_status_changed').length;
  const reviewActions = recentFeed.filter(f => f.action === 'review_completed' || f.action === 'approval_granted').length;
  const blockers = recentSignals.filter(s => s.type === 'blocker').length;
  const reassignments = recentFeed.filter(f => f.action === 'task_assigned').length;

  if (statusChanges > 0 && reviewActions === 0) {
    insights.push({
      id: `risk-review-gap-${Date.now()}`,
      type: 'risk',
      severity: 'warning',
      title: 'Review participation gap',
      description: `${statusChanges} status changes with no completed reviews — execution may outpace quality verification`,
      timestamp: now,
    });
  }

  if (blockers >= 3) {
    insights.push({
      id: `risk-blocker-${Date.now()}`,
      type: 'risk',
      severity: blockers >= 5 ? 'critical' : 'warning',
      title: 'Blocker accumulation',
      description: `${blockers} blocker discussions in recent activity — may impact sprint momentum`,
      timestamp: now,
    });
  }

  if (reassignments >= 4) {
    insights.push({
      id: `risk-reassign-${Date.now()}`,
      type: 'risk',
      severity: 'notice',
      title: 'Elevated task reassignment',
      description: `${reassignments} task reassignments detected — may indicate scope or priority churn`,
      timestamp: now,
    });
  }

  if (vitality.stability < 30) {
    insights.push({
      id: `risk-stability-${Date.now()}`,
      type: 'risk',
      severity: 'warning',
      title: 'Execution stability low',
      description: `Stability score at ${vitality.stability}/100 — high blocker or reassignment activity affecting operational flow`,
      timestamp: now,
    });
  }

  const activeUsers = presences.filter(p => !p.idle && p.state !== 'away').length;
  if (activeUsers <= 1 && (statusChanges > 0 || blockers > 0)) {
    insights.push({
      id: `risk-isolated-${Date.now()}`,
      type: 'risk',
      severity: 'notice',
      title: 'Low collaboration coverage',
      description: `Only ${activeUsers} active contributor(s) with ongoing execution activity — coordination gaps may form`,
      timestamp: now,
    });
  }

  return insights;
}
