import { motion } from 'motion/react';

interface RiskMeterProps {
  score: number;
  maxScore?: number;
  label?: string;
}

function riskColor(ratio: number): string {
  if (ratio < 0.3) return 'bg-emerald-400';
  if (ratio < 0.6) return 'bg-amber-400';
  return 'bg-red-400';
}

function riskText(ratio: number): string {
  if (ratio < 0.3) return 'text-emerald-400';
  if (ratio < 0.6) return 'text-amber-400';
  return 'text-red-400';
}

export function RiskMeter({ score, maxScore = 100, label }: RiskMeterProps) {
  const ratio = Math.min(score / maxScore, 1);
  return (
    <div className="space-y-1">
      {label && <div className="text-[10px] uppercase font-mono tracking-wider text-white/50">{label}</div>}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${ratio * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={`h-full rounded-full ${riskColor(ratio)}`}
          />
        </div>
        <span className={`text-[11px] font-mono ${riskText(ratio)}`}>{score}</span>
      </div>
    </div>
  );
}
