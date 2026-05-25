import { motion } from 'motion/react';
import { slideUp } from '../../lib/animation';

interface EmptyAction {
  label: string;
  onClick: () => void;
}

interface WidgetCardProps {
  title: string;
  children: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  emptyAction?: EmptyAction;
  action?: React.ReactNode;
  className?: string;
}

export function WidgetCard({ title, children, loading, error, empty, emptyMessage, emptyAction, action, className = '' }: WidgetCardProps) {
  return (
    <motion.div variants={slideUp} initial="hidden" animate="visible" className={`bg-surface border border-border ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <h3 className="text-[10px] uppercase font-sans tracking-tight tracking-wider text-text-secondary">{title}</h3>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      <div className="p-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-3 bg-white/5 rounded transition-opacity duration-300" />
            <div className="h-3 bg-white/5 rounded w-3/4 transition-opacity duration-300" />
            <div className="h-3 bg-white/5 rounded w-1/2 transition-opacity duration-300" />
          </div>
        ) : error ? (
          <div className="text-[11px] text-signal-critical/70 font-mono">{error}</div>
        ) : empty ? (
          <div className="text-center py-6">
            <p className="text-[11px] font-mono text-text-quaternary mb-3">{emptyMessage || 'No data'}</p>
            {emptyAction && (
              <button
                onClick={emptyAction.onClick}
                className="text-[10px] uppercase font-medium tracking-wider text-text-tertiary hover:text-text-secondary transition-colors border border-border px-3 py-1.5 hover:border-border"
              >
                {emptyAction.label} →
              </button>
            )}
          </div>
        ) : children}
      </div>
    </motion.div>
  );
}
