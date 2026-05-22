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
}

const MAX_INSIGHTS = 3;

const CONFIDENCE_LABELS = { high: 'High', medium: 'Med', low: 'Low' };
const CONFIDENCE_COLORS = { high: 'text-emerald-400/70', medium: 'text-amber-400/70', low: 'text-white/30' };

const TYPE_LABELS: Record<string, string> = {
  'blocked-sprint': 'Sprint Blocked',
  'overdue-cluster': 'Overdue Cluster',
  'workload-imbalance': 'Workload Alert',
  'stalled-project': 'Project Stalled',
};

export function AIInsights({ insights, loading, error, onDismiss }: AIInsightsProps) {
  const visible = insights ? insights.slice(0, MAX_INSIGHTS) : [];

  return (
    <WidgetCard
      title="AI Insights"
      loading={loading}
      error={error}
      empty={!loading && !error && visible.length === 0}
      emptyMessage="No insights right now"
      action={<Sparkles className="w-3 h-3 text-white/30" />}
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
              className="group relative bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors"
            >
              <div className="p-3 pr-8">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-white/40">
                    {TYPE_LABELS[insight.type] || insight.type}
                  </span>
                  <span className={`text-[9px] font-mono ${CONFIDENCE_COLORS[insight.confidence]}`}>
                    {CONFIDENCE_LABELS[insight.confidence]}
                  </span>
                </div>
                <p className="text-[12px] font-mono text-white/70 leading-relaxed">
                  {insight.message}
                </p>
                {insight.actionLabel && insight.onAction && (
                  <button
                    onClick={insight.onAction}
                    className="mt-1.5 text-[10px] font-mono text-white/50 hover:text-white/80 transition-colors"
                  >
                    {insight.actionLabel} →
                  </button>
                )}
              </div>
              {onDismiss && (
                <button
                  onClick={() => onDismiss(insight.id)}
                  className="absolute top-2 right-2 p-0.5 text-white/20 hover:text-white/60 opacity-0 group-hover:opacity-100 transition-all"
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
