import React from 'react';
import { Lightbulb } from 'lucide-react';

export function RecommendationsList({ items }: { items: any[] }) {
  if (items.length === 0) return null;

  return (
    <div className="premium-panel rounded-2xl flex flex-col border border-[var(--border-soft)]">
      <div className="px-5 py-4 border-b border-[var(--border-soft)] flex justify-between items-center">
        <h3 className="font-semibold text-sm text-white flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          Smart Recommendations
        </h3>
      </div>
      <div className="divide-y divide-[var(--border-soft)]">
        {items.map(item => (
          <div key={item.id} className="p-4 flex gap-3 items-start hover:bg-[var(--surface-hover)] transition-colors">
            <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
              item.type === 'urgent' ? 'bg-rose-500' :
              item.type === 'action' ? 'bg-amber-500' : 'bg-indigo-500'
            }`} />
            <p className="text-sm text-[var(--text-secondary)]">{item.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
