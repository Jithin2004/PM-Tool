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

export function MetricTile({ label, value, icon: Icon, trend, color = 'text-white', loading, onClick }: MetricTileProps) {
  if (loading) {
    return (
      <div className="bg-[#0c0c0c] border border-white/10 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="h-2 w-16 bg-white/5 rounded animate-pulse" />
          <div className="w-3.5 h-3.5 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="h-7 w-12 bg-white/5 rounded animate-pulse mt-1" />
      </div>
    );
  }

  return (
    <motion.div
      variants={scaleIn} initial="hidden" animate="visible"
      className={`bg-[#0c0c0c] border border-white/10 p-4 ${onClick ? 'cursor-pointer hover:bg-white/[0.02] transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] uppercase font-mono tracking-wider text-white/50">{label}</span>
        <Icon className="w-3.5 h-3.5 text-white/40" />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={String(value)}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.2 }}
          className={`text-xl sm:text-2xl font-mono font-medium ${color}`}
        >
          {value}
        </motion.div>
      </AnimatePresence>
      {trend && (
        <div className={`flex items-center gap-1 mt-1 text-[10px] font-mono ${trend.positive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
          <span>{trend.positive ? '↑' : '↓'}</span>
          <span>{Math.abs(trend.value)}%</span>
        </div>
      )}
    </motion.div>
  );
}
