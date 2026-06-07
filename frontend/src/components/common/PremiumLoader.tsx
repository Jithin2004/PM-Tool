import React from 'react';

interface PremiumLoaderProps {
  type?: 'page' | 'card' | 'table';
  count?: number; // for skeleton counts
  label?: string; // for page type label
}

export function PremiumLoader({
  type = 'page',
  count = 3,
  label = 'Loading System Resources...'
}: PremiumLoaderProps) {
  if (type === 'page') {
    return (
      <div className="w-full min-h-[300px] flex flex-col items-center justify-center gap-5 select-none py-12">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border border-[var(--border-soft)]" />
          <div className="absolute inset-0 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'rgba(124, 58, 237, 0.15)', borderTopColor: '#7c3aed' }} />
        </div>
        <div className="text-center space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent-primary animate-pulse">
            {label}
          </p>
        </div>
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 w-full">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="premium-panel p-6 rounded-xl space-y-4 animate-pulse">
            <div className="flex justify-between items-center">
              <div className="h-3 w-2/5 bg-[var(--surface-glass)] rounded" />
              <div className="h-4 w-4 bg-[var(--surface-glass)] rounded-full" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-5/6 bg-[var(--surface-glass)] rounded" />
              <div className="h-3 w-full bg-[var(--surface-glass)] rounded" />
            </div>
            <div className="pt-4 border-t border-[var(--border-soft)] flex gap-2">
              <div className="h-5 w-16 bg-[var(--surface-glass)] rounded" />
              <div className="h-5 w-24 bg-[var(--surface-glass)] rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="w-full premium-panel rounded-xl overflow-hidden animate-pulse">
        <div className="h-10 bg-[var(--surface-glass)] border-b border-[var(--border-soft)] flex items-center px-6 gap-4">
          <div className="h-3 w-1/6 bg-[var(--surface-glass)] rounded" />
          <div className="h-3 w-1/4 bg-[var(--surface-glass)] rounded" />
          <div className="h-3 w-1/5 bg-[var(--surface-glass)] rounded" />
          <div className="h-3 w-1/12 bg-[var(--surface-glass)] rounded ml-auto" />
        </div>
        <div className="divide-y divide-white/5">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="h-12 flex items-center px-6 gap-4">
              <div className="h-3 w-1/5 bg-[var(--surface-glass)] rounded" />
              <div className="h-3 w-1/3 bg-[var(--surface-glass)] rounded" />
              <div className="h-3 w-1/6 bg-[var(--surface-glass)] rounded" />
              <div className="h-6 w-14 bg-[var(--surface-glass)] rounded-full ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
