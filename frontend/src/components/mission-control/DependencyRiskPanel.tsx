import type { Prediction } from '../../core/prediction/types';
import type { AiInsight } from '../../core/ai/types';

interface DependencyRiskPanelProps {
  predictions: Prediction[];
  insights: AiInsight[];
}

const PREDICTION_TYPE_COLORS: Record<string, string> = {
  dependency_escalation: 'border-l-signal-warning',
  overload: 'border-l-signal-critical',
  sprint_instability: 'border-l-signal-warning',
  delay_risk: 'border-l-accent-secondary',
  blocker_risk: 'border-l-signal-critical',
};

export function DependencyRiskPanel({ predictions, insights }: DependencyRiskPanelProps) {
  const dependencyPredictions = predictions.filter(
    p => p.type === 'dependency_escalation' || p.type === 'blocker_risk',
  );

  const dependencyInsights = insights.filter(
    i => i.type === 'risk' && i.severity !== 'info',
  );

  const items = [
    ...dependencyPredictions.map(p => ({
      id: p.id,
      type: 'prediction' as const,
      subtype: p.type,
      title: p.title,
      description: p.description,
      probability: p.probability,
      timestamp: p.timestamp,
    })),
    ...dependencyInsights.map(i => ({
      id: i.id,
      type: 'insight' as const,
      subtype: i.type,
      title: i.title,
      description: i.description,
      probability: null as number | null,
      timestamp: i.timestamp,
    })),
  ].slice(0, 5);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">dependency risk</div>

      {items.map(item => {
        const borderColor = item.type === 'prediction'
          ? PREDICTION_TYPE_COLORS[item.subtype] || 'border-l-border'
          : 'border-l-accent-primary';

        return (
          <div key={item.id} className={`pl-2 border-l-2 ${borderColor} py-0.5`}>
            <p className="text-[10px] font-medium text-text-primary">{item.title}</p>
            <p className="text-[9px] text-text-tertiary">{item.description}</p>
            {item.probability !== null && (
              <span className="text-[9px] font-mono-pm text-text-secondary">
                {Math.round(item.probability * 100)}% confidence
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
