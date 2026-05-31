import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-surface-2 border border-dashed border-border rounded-xl">
      <div className="w-16 h-16 bg-surface border border-border rounded-full flex items-center justify-center mb-4 shadow-sm">
        <Icon className="w-8 h-8 text-text-quaternary" />
      </div>
      <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-2">{title}</h3>
      <p className="text-xs text-text-tertiary max-w-md mx-auto mb-6 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <button 
          onClick={onAction}
          className="px-6 py-2 bg-accent-primary hover:bg-accent-primary/90 text-gray-900 dark:text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-accent-primary/20"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
