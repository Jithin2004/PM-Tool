import { Sparkles } from 'lucide-react';
import { WidgetCard } from '../widgets/WidgetCard';
import { InsightCard } from '../widgets/InsightCard';

interface AIInsight {
  id: string;
  type: 'blocker' | 'risk' | 'overdue' | 'suggestion';
  message: string;
  confidence?: 'low' | 'medium' | 'high';
  actionLabel?: string;
  onAction?: () => void;
}

interface AIInsightsProps {
  insights?: AIInsight[];
  loading?: boolean;
  error?: string | null;
  onDismiss?: (id: string) => void;
}

export function AIInsights({ insights, loading, error, onDismiss }: AIInsightsProps) {
  const hasData = insights && insights.length > 0;

  return (
    <WidgetCard
      title="AI Insights"
      loading={loading}
      error={error}
      empty={!loading && !error && !hasData}
      emptyMessage="No insights right now"
      action={<Sparkles className="w-3 h-3 text-white/30" />}
    >
      {hasData && (
        <div className="space-y-2">
          {insights.map((insight) => (
            <InsightCard
              key={insight.id}
              type={insight.type}
              message={insight.message}
              confidence={insight.confidence}
              actionLabel={insight.actionLabel}
              onAction={insight.onAction}
              onDismiss={onDismiss ? () => onDismiss(insight.id) : undefined}
            />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
