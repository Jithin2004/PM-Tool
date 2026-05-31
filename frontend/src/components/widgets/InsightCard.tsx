import { Lightbulb, AlertTriangle, TrendingUp, Sparkles, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { slideUp } from '../../lib/animation';

type InsightType = 'blocker' | 'risk' | 'overdue' | 'suggestion';

interface InsightCardProps {
  type: InsightType;
  message: string;
  confidence?: 'low' | 'medium' | 'high';
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

const iconMap: Record<InsightType, LucideIcon> = {
  blocker: AlertTriangle,
  risk: TrendingUp,
  overdue: AlertTriangle,
  suggestion: Sparkles,
};

const colorMap: Record<InsightType, string> = {
  blocker: 'border-red-500/20 bg-signal-critical-bg',
  risk: 'border-border bg-signal-warning-bg',
  overdue: 'border-red-500/20 bg-signal-critical-bg',
  suggestion: 'border-emerald-500/20 bg-emerald-500/5',
};

const iconColorMap: Record<InsightType, string> = {
  blocker: 'text-signal-critical',
  risk: 'text-signal-warning',
  overdue: 'text-signal-critical',
  suggestion: 'text-emerald-400',
};

const confidenceDots: Record<string, string> = {
  low: 'bg-[var(--pm-surface)]/20',
  medium: 'bg-amber-400',
  high: 'bg-emerald-400',
};

export function InsightCard({ type, message, confidence = 'medium', actionLabel, onAction, onDismiss }: InsightCardProps) {
  const Icon = iconMap[type];
  return (
    <motion.div variants={slideUp} initial="hidden" animate="visible" className={`flex items-start gap-3 p-3 border ${colorMap[type]}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColorMap[type]}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-mono text-text-secondary">{message}</div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${confidenceDots[confidence]}`} />
          <span className="text-[9px] font-mono text-text-quaternary uppercase tracking-wider">{confidence}</span>
          {actionLabel && onAction && (
            <button onClick={onAction} className="text-[10px] font-medium text-text-tertiary hover:text-text-primary transition-colors ml-auto">
              {actionLabel}
            </button>
          )}
          {onDismiss && (
            <button onClick={onDismiss} className="text-[10px] font-medium text-text-quaternary hover:text-text-tertiary transition-colors">
              Dismiss
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
