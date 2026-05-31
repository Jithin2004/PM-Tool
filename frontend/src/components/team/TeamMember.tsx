import React from 'react';
import { motion } from 'framer-motion';

export function TeamMember({ name, role, load, efficiency, urgent }: { name: string, role: string, load: number, efficiency: number, urgent?: boolean }) {
  const loadColor = load < 70 ? 'text-signal-safe' : load < 100 ? 'text-signal-warning' : 'text-signal-critical';
  const loadBg = load < 70 ? 'bg-signal-safe-bg' : load < 100 ? 'bg-signal-warning-bg' : 'bg-signal-critical-bg';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="text-xs font-medium text-text-secondary">{name}</h4>
          <p className="text-[10px] font-mono text-text-secondary uppercase">{role}</p>
        </div>
        <div className={`px-2 py-0.5 rounded-sm ${loadBg} ${loadColor} text-[11px] font-mono font-bold`}>
          {load}% LOAD
        </div>
      </div>
      <div className="w-full bg-[var(--pm-surface)]/5 h-1 relative overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, load)}%` }}
          className={`h-full ${load >= 100 ? 'bg-red-500' : load >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-text-secondary uppercase">
        <span>Efficiency: {(efficiency * 100).toFixed(0)}%</span>
        <span>{load > 100 ? 'CRITICAL_OVERAGE' : 'STABLE BANDWIDTH'}</span>
      </div>
    </div>
  );
}
