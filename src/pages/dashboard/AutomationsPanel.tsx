import React from 'react';

export default function AutomationsPanel() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">CONTROL</span>
        <span className="text-white/20">/</span>
        <span className="text-xs font-mono text-white/80">Automations</span>
      </div>
      <div className="border border-white/10 bg-white/[0.02] p-12 flex flex-col items-center justify-center text-center">
        <span className="text-[11px] font-mono text-white/30 uppercase tracking-wider">Automation Engine</span>
        <span className="text-[9px] font-mono text-white/20 mt-2">Approval workflows, triggers, marketplace — coming soon</span>
      </div>
    </div>
  );
}
