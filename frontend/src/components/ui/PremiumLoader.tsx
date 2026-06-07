import React from 'react';

interface PremiumLoaderProps {
  type?: 'spinner' | 'shimmer-card' | 'shimmer-table' | 'shimmer-list';
  message?: string;
}

export function PremiumLoader({ type = 'spinner', message }: PremiumLoaderProps) {
  if (type === 'shimmer-card') {
    return (
      <div className="w-full bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded-2xl p-6 overflow-hidden relative">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-[var(--surface-hover)] to-transparent" />
        <div className="w-12 h-12 rounded-xl bg-[var(--surface-hover)] mb-4" />
        <div className="h-4 w-1/3 bg-[var(--surface-hover)] rounded mb-3" />
        <div className="h-3 w-1/2 bg-[var(--surface-hover)] rounded mb-2" />
        <div className="h-3 w-2/3 bg-[var(--surface-hover)] rounded" />
      </div>
    );
  }

  if (type === 'shimmer-list') {
    return (
      <div className="w-full space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="w-full h-16 bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded-xl relative overflow-hidden">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-[var(--surface-hover)] to-transparent" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'shimmer-table') {
    return (
      <div className="w-full border border-[var(--border-soft)] rounded-xl overflow-hidden bg-[var(--surface-glass)]">
        <div className="h-10 bg-[var(--surface-hover)] border-b border-[var(--border-soft)]" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-14 border-b border-[var(--border-soft)] relative overflow-hidden">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-[var(--surface-hover)] to-transparent" />
          </div>
        ))}
      </div>
    );
  }

  // Fallback spinner (premium pulse)
  return (
    <div className="flex flex-col items-center justify-center p-8 w-full h-full">
      <div className="relative w-8 h-8 flex items-center justify-center mb-4">
        <div className="absolute inset-0 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
        <div className="absolute inset-2 bg-[var(--accent-primary)]/20 rounded-full animate-pulse" />
      </div>
      {message && (
        <span className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] animate-pulse">
          {message}
        </span>
      )}
    </div>
  );
}
