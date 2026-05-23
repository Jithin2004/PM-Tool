import type { Prediction } from '../../core/prediction/types';
import type { AiInsight } from '../../core/ai/types';

interface DependencyRiskPanelProps {
  predictions: Prediction[];
  insights: AiInsight[];
}

const PREDICTION_TYPE_COLORS: Record<string, string> = {
  dependency_escalation: 'border-l-amber-400',
  overload: 'border-l-red-300',
  sprint_instability: 'border-l-amber-500',
  delay_risk: 'border-l-orange-300',
  blocker_risk: 'border-l-red-400',
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
      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">dependency risk</div>

      {items.map(item => {
        const borderColor = item.type === 'prediction'
          ? PREDICTION_TYPE_COLORS[item.subtype] || 'border-l-gray-300'
          : 'border-l-blue-300';

        return (
          <div key={item.id} className={`pl-2 border-l-2 ${borderColor} py-0.5`}>
            <p className="text-[10px] font-medium text-gray-700">{item.title}</p>
            <p className="text-[9px] text-gray-500">{item.description}</p>
            {item.probability !== null && (
              <span className="text-[9px] font-mono text-gray-400">
                {Math.round(item.probability * 100)}% confidence
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
