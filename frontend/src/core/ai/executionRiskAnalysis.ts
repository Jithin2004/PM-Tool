import type { CollaborationSignal, ActivityEntry, OperationalPresence } from '../presence/types';
import type { VitalityScore, Bottleneck } from '../coordination/types';
import type { AiInsight } from './types';
import { intelligenceQueryEngine } from '../engines/intelligenceQueryEngine';

export async function analyzeExecutionRisks(
  workspaceId: string,
  presences: OperationalPresence[],
  signals: CollaborationSignal[],
  feed: ActivityEntry[],
  vitality: VitalityScore,
  bottlenecks: Bottleneck[],
): Promise<AiInsight[]> {
  const insights: AiInsight[] = [];
  const now = new Date().toISOString();

  const anomalies = await intelligenceQueryEngine.getActivityAnomalies(workspaceId);

  for (const anomaly of anomalies) {
    insights.push({
      id: `risk-${anomaly.type}-${Date.now()}`,
      type: 'risk',
      severity: 'notice',
      title: 'Unusual Activity Noticed',
      description: anomaly.insight,
      timestamp: now,
    });
  }

  return insights;
}
