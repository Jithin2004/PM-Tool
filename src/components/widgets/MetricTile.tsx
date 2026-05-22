import { motion } from 'motion/react';
import { scaleIn } from '../../lib/animation';
import type { LucideIcon } from 'lucide-react';

interface MetricTileProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  color?: string;
  onClick?: () => void;
}

export function MetricTile({ label, value, icon: Icon, trend, color = 'text-white', onClick }: MetricTileProps) {
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
      <div className={`text-xl sm:text-2xl font-mono font-medium ${color}`}>{value}</div>
      {trend && (
        <div className={`flex items-center gap-1 mt-1 text-[10px] font-mono ${trend.positive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
          <span>{trend.positive ? '↑' : '↓'}</span>
          <span>{Math.abs(trend.value)}%</span>
        </div>
      )}
    </motion.div>
  );
}
