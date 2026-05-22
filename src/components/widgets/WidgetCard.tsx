import { motion } from 'motion/react';
import { slideUp } from '../../lib/animation';

interface WidgetCardProps {
  title: string;
  children: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  action?: React.ReactNode;
  className?: string;
}

export function WidgetCard({ title, children, loading, error, empty, emptyMessage, action, className = '' }: WidgetCardProps) {
  return (
    <motion.div variants={slideUp} initial="hidden" animate="visible" className={`bg-[#0c0c0c] border border-white/10 ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h3 className="text-[10px] uppercase font-mono tracking-wider text-white/70">{title}</h3>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      <div className="p-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-3 bg-white/5 rounded animate-pulse" />
            <div className="h-3 bg-white/5 rounded w-3/4 animate-pulse" />
            <div className="h-3 bg-white/5 rounded w-1/2 animate-pulse" />
          </div>
        ) : error ? (
          <div className="text-[11px] text-red-400/70 font-mono">{error}</div>
        ) : empty ? (
          <div className="text-[11px] text-white/30 font-mono text-center py-6">{emptyMessage || 'No data'}</div>
        ) : children}
      </div>
    </motion.div>
  );
}
