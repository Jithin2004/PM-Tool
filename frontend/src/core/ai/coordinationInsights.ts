import type { CollaborationSignal } from '../presence/types';
import type { OperationalPattern, Bottleneck, VitalityScore, CoordinationDensity } from '../coordination/types';
import type { AiInsight } from './types';

export function generateCoordinationInsights(
  density: CoordinationDensity,
  patterns: OperationalPattern[],
  bottlenecks: Bottleneck[],
  vitality: VitalityScore,
  signals: CollaborationSignal[],
): AiInsight[] {
  const insights: AiInsight[] = [];
  const now = new Date().toISOString();

  if (density.collaborationIntensity === 'very_high' || density.collaborationIntensity === 'high') {
    const editingCount = signals.filter(s => s.type === 'editing').length;
    insights.push({
      id: `coord-intensity-${Date.now()}`,
      type: 'coordination',
      severity: 'notice',
      title: 'Coordination activity elevated',
      description: editingCount >= 5
        ? `${density.totalActive} contributors active with ${editingCount} editing — coordination density is high`
        : `Coordination activity is elevated with ${density.totalActive} active contributors`,
      timestamp: now,
    });
  }

  for (const pattern of patterns) {
    if (pattern.severity === 'critical' || pattern.severity === 'warning') {
      insights.push({
        id: `pattern-${pattern.id}`,
        type: 'pattern',
        severity: pattern.severity === 'critical' ? 'warning' : 'notice',
        title: pattern.title,
        description: pattern.description,
        context: pattern.context.projectId ? { projectId: pattern.context.projectId } : undefined,
        timestamp: pattern.timestamp,
      });
    }
  }

  for (const bottle of bottlenecks) {
    insights.push({
      id: `bottleneck-${bottle.id}`,
      type: 'risk',
      severity: bottle.severity === 'critical' ? 'critical' : bottle.severity === 'warning' ? 'warning' : 'notice',
      title: bottle.title,
      description: bottle.description,
      context: bottle.context.projectId ? { projectId: bottle.context.projectId } : undefined,
      timestamp: bottle.timestamp,
    });
  }

  if (vitality.level === 'low' || vitality.level === 'moderate') {
    const weakest = ['coordination', 'momentum', 'participation', 'stability']
      .reduce((a, b) => vitality[a as keyof VitalityScore] < vitality[b as keyof VitalityScore] ? a : b);

    insights.push({
      id: `vitality-${Date.now()}`,
      type: 'vitality',
      severity: vitality.level === 'low' ? 'warning' : 'notice',
      title: vitality.level === 'low' ? 'Execution vitality declining' : 'Moderate execution vitality',
      description: `Overall vitality at ${vitality.overall}/100 — ${weakest} is the weakest dimension (${vitality[weakest as keyof VitalityScore]}/100)`,
      timestamp: now,
    });
  }

  return insights;
}
