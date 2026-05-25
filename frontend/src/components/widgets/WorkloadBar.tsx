import { motion } from 'motion/react';

interface WorkloadBarProps {
  label: string;
  value: number;
  maxValue?: number;
  status?: 'healthy' | 'warning' | 'critical';
  onClick?: () => void;
}

const barColors: Record<string, string> = {
  healthy: 'bg-emerald-400',
  warning: 'bg-amber-400',
  critical: 'bg-red-400',
};

export function WorkloadBar({ label, value, maxValue = 100, status = 'healthy', onClick }: WorkloadBarProps) {
  const ratio = Math.min(value / maxValue, 1);
  return (
    <div
      className={`flex items-center gap-3 py-1.5 ${onClick ? 'cursor-pointer hover:bg-surface-3 transition-colors px-2 rounded' : ''}`}
      onClick={onClick}
    >
      <span className="text-[11px] font-mono text-text-secondary w-24 truncate shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${ratio * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`h-full rounded-full ${barColors[status]}`}
        />
      </div>
      <span className="text-[10px] font-mono text-text-quaternary w-8 text-right shrink-0">{value}%</span>
    </div>
  );
}
