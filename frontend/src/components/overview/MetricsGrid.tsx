import React from 'react';

export function MetricsGrid({ metrics }: { metrics: any[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map(m => (
        <div key={m.id} className="premium-panel premium-hover-lift rounded-2xl p-5 border border-[var(--border-soft)]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
            <span>{m.label}</span>
          </div>
          <div className={`text-2xl font-bold font-mono tracking-tight mt-2 ${
            m.status === 'critical' ? 'text-rose-400' : 
            m.status === 'warning' ? 'text-amber-400' : 'text-white'
          }`}>
            {m.value}
          </div>
        </div>
      ))}
    </div>
  );
}
