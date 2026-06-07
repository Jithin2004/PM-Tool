import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PremiumEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  accentColor?: string; // e.g. '#7c3aed'
}

export function PremiumEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  accentColor = '#7c3aed'
}: PremiumEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[300px] select-none rounded-xl border border-border/50 bg-black/10">
      <div className="relative w-14 h-14 flex items-center justify-center mb-5">
        {/* Glow circle overlay */}
        <div className="absolute inset-0 rounded-full blur-md opacity-25 animate-pulse"
          style={{ background: accentColor }} />
        <div className="relative w-12 h-12 rounded-full flex items-center justify-center border bg-surface-2"
          style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <Icon className="w-5 h-5" style={{ color: accentColor }} />
        </div>
      </div>
      <h3 className="text-sm font-semibold tracking-tight text-text-primary mb-1">{title}</h3>
      <p className="text-xs text-text-secondary max-w-[240px] leading-relaxed mb-5">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="btn-premium-primary px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg active:scale-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
