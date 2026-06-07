import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PremiumEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export function PremiumEmptyState({ icon: Icon, title, description, action, compact = false }: PremiumEmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8' : 'py-16'} px-4 w-full h-full`}>
      <div className="w-12 h-12 rounded-xl bg-[var(--surface-hover)] border border-[var(--border-soft)] flex items-center justify-center mb-4 shadow-[var(--premium-shadow)]">
        <Icon className="w-6 h-6 text-[var(--text-muted)]" />
      </div>
      <h3 className="text-sm font-semibold tracking-tight text-[var(--text-primary)] mb-1 font-geist">{title}</h3>
      <p className="text-xs text-[var(--text-muted)] max-w-[250px] mx-auto mb-6 leading-relaxed font-geist">
        {description}
      </p>
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  );
}
