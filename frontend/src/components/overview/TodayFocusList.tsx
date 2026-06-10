import React from 'react';
import { Target } from 'lucide-react';
import { PremiumEmptyState } from '../ui/PremiumEmptyState';

export function TodayFocusList({ items }: { items: any[] }) {
  if (items.length === 0) {
    return (
      <PremiumEmptyState 
        icon={Target} 
        title="No Priority Items" 
        description="You have no immediate tasks requiring attention today. Enjoy the calm!" 
      />
    );
  }

  return (
    <div className="premium-panel rounded-2xl flex flex-col border border-[var(--border-soft)]">
      <div className="px-5 py-4 border-b border-[var(--border-soft)] flex justify-between items-center">
        <h3 className="font-semibold text-sm text-white flex items-center gap-2">
          <Target className="w-4 h-4 text-indigo-400" />
          Today's Focus
        </h3>
      </div>
      <div className="divide-y divide-[var(--border-soft)]">
        {items.map(item => (
          <div key={item.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-[var(--surface-hover)] transition-colors">
            <div>
              <h4 className="text-sm font-medium text-white">{item.title}</h4>
              {item.subtitle && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{item.subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-[10px] uppercase font-mono font-bold tracking-widest border ${
                item.priority === 'High' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-[var(--surface-glass)] text-[var(--text-secondary)] border-[var(--border-soft)]'
              }`}>
                {item.priority}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
