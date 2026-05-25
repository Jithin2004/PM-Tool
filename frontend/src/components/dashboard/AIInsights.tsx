import { Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { slideUp } from '../../lib/animation';
import { WidgetCard } from '../widgets/WidgetCard';

interface AIInsight {
  id: string;
  type: 'blocked-sprint' | 'overdue-cluster' | 'workload-imbalance' | 'stalled-project';
  message: string;
  confidence: 'low' | 'medium' | 'high';
  actionLabel?: string;
  onAction?: () => void;
}

interface AIInsightsProps {
  insights?: AIInsight[];
  loading?: boolean;
  error?: string | null;
  onDismiss?: (id: string) => void;
  emptyAction?: { label: string; onClick: () => void };
}

const MAX_INSIGHTS = 3;

const CONFIDENCE_LABELS = { high: 'High', medium: 'Med', low: 'Low' };
const CONFIDENCE_COLORS = { high: 'text-emerald-400/70', medium: 'text-signal-warning/70', low: 'text-text-quaternary' };

const TYPE_LABELS: Record<string, string> = {
  'blocked-sprint': 'Sprint Blocked',
  'overdue-cluster': 'Overdue Cluster',
  'workload-imbalance': 'Workload Alert',
  'stalled-project': 'Project Stalled',
};

export function AIInsights({ insights, loading, error, onDismiss, emptyAction }: AIInsightsProps) {
  const visible = insights ? insights.slice(0, MAX_INSIGHTS) : [];

  return (
    <WidgetCard
      title="AI Insights"
      loading={loading}
      error={error}
      empty={!loading && !error && visible.length === 0}
      emptyMessage="No insights right now"
      emptyAction={emptyAction}
      action={<Sparkles className="w-3 h-3 text-text-quaternary" />}
    >
      <AnimatePresence initial={false}>
        <div className="space-y-1.5">
          {visible.map((insight) => (
            <motion.div
              key={insight.id}
              variants={slideUp}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.2 }}
              className="group relative bg-surface-3 border border-border-subtle hover:border-border transition-colors"
            >
              <div className="p-3 pr-8">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-text-quaternary">
                    {TYPE_LABELS[insight.type] || insight.type}
                  </span>
                  <span className={`text-[9px] font-mono ${CONFIDENCE_COLORS[insight.confidence]}`}>
                    {CONFIDENCE_LABELS[insight.confidence]}
                  </span>
                </div>
                <p className="text-[12px] font-mono text-text-secondary leading-relaxed">
                  {insight.message}
                </p>
                {insight.actionLabel && insight.onAction && (
                  <button
                    onClick={insight.onAction}
                    className="mt-1.5 text-[10px] font-medium text-text-tertiary hover:text-text-secondary transition-colors"
                  >
                    {insight.actionLabel} →
                  </button>
                )}
              </div>
              {onDismiss && (
                <button
                  onClick={() => onDismiss(insight.id)}
                  className="absolute top-2 right-2 p-0.5 text-text-quaternary hover:text-text-tertiary opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </WidgetCard>
  );
}
