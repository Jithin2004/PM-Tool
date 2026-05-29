import { AnimatePresence, motion } from 'motion/react';
import { scaleIn } from '../../lib/animation';
import type { LucideIcon } from 'lucide-react';

interface MetricTileProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  color?: string;
  loading?: boolean;
  onClick?: () => void;
}

export function MetricTile({ label, value, icon: Icon, trend, color = 'text-text-primary', loading, onClick }: MetricTileProps) {
  if (loading) {
    return (
      <div className="bg-surface-3/50 backdrop-blur-md border border-border/50 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="h-3 w-16 bg-surface-3 rounded-full transition-opacity duration-300" />
          <div className="w-5 h-5 bg-surface-3 rounded-full transition-opacity duration-300" />
        </div>
        <div className="h-8 w-20 bg-surface-3 rounded-full transition-opacity duration-300 mt-2" />
      </div>
    );
  }

  return (
    <motion.div
      variants={scaleIn} initial="hidden" animate="visible"
      className={`bg-surface-3/50 backdrop-blur-md border border-border/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all ${onClick ? 'cursor-pointer hover:bg-surface/50 hover:border-teal-500/30 hover:-translate-y-0.5' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold tracking-widest text-text-secondary uppercase">{label}</span>
        <Icon className="w-5 h-5 text-text-quaternary" />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={String(value)}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.2 }}
          className={`text-2xl sm:text-3xl font-bold tracking-tight ${color === 'text-text-primary' ? 'bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent' : color}`}
        >
          {value}
        </motion.div>
      </AnimatePresence>
      {trend && (
        <div className={`flex items-center gap-1.5 mt-2 text-xs font-bold ${trend.positive ? 'text-emerald-400' : 'text-red-400'}`}>
          <span>{trend.positive ? '↑' : '↓'}</span>
          <span>{Math.abs(trend.value)}%</span>
        </div>
      )}
    </motion.div>
  );
}
