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
  blocker: 'border-red-500/20 bg-red-500/5',
  risk: 'border-amber-500/20 bg-amber-500/5',
  overdue: 'border-red-500/20 bg-red-500/5',
  suggestion: 'border-emerald-500/20 bg-emerald-500/5',
};

const iconColorMap: Record<InsightType, string> = {
  blocker: 'text-red-400',
  risk: 'text-amber-400',
  overdue: 'text-red-400',
  suggestion: 'text-emerald-400',
};

const confidenceDots: Record<string, string> = {
  low: 'bg-white/20',
  medium: 'bg-amber-400',
  high: 'bg-emerald-400',
};

export function InsightCard({ type, message, confidence = 'medium', actionLabel, onAction, onDismiss }: InsightCardProps) {
  const Icon = iconMap[type];
  return (
    <motion.div variants={slideUp} initial="hidden" animate="visible" className={`flex items-start gap-3 p-3 border ${colorMap[type]}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColorMap[type]}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-mono text-white/80">{message}</div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${confidenceDots[confidence]}`} />
          <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider">{confidence}</span>
          {actionLabel && onAction && (
            <button onClick={onAction} className="text-[10px] font-mono text-white/50 hover:text-white transition-colors ml-auto">
              {actionLabel}
            </button>
          )}
          {onDismiss && (
            <button onClick={onDismiss} className="text-[10px] font-mono text-white/20 hover:text-white/50 transition-colors">
              Dismiss
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
