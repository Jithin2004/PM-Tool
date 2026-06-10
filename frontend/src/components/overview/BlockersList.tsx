import React from 'react';
import { AlertTriangle } from 'lucide-react';

export function BlockersList({ items }: { items: any[] }) {
  if (items.length === 0) return null;

  return (
    <div className="premium-panel rounded-2xl flex flex-col border border-rose-500/20 bg-rose-500/5">
      <div className="px-5 py-4 border-b border-rose-500/20 flex justify-between items-center">
        <h3 className="font-semibold text-sm text-rose-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Blockers
        </h3>
      </div>
      <div className="divide-y divide-rose-500/10">
        {items.map(item => (
          <div key={item.id} className="p-4 flex flex-col gap-1">
            <h4 className="text-sm font-medium text-white">{item.title}</h4>
            <p className="text-xs text-rose-300/70">{item.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
