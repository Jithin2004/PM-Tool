import React from 'react';

interface PremiumLoaderProps {
  type?: 'page' | 'card' | 'table';
  count?: number; // for skeleton counts
  label?: string; // for compatibility, ignored or used
}

export function PremiumLoader({
  type = 'page',
  count = 3,
  label = 'Loading...'
}: PremiumLoaderProps) {
  if (type === 'page') {
    return (
      <div className="w-full space-y-6 py-6 animate-pulse select-none">
        {/* Page Header skeleton */}
        <div className="flex justify-between items-center w-full mb-8">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-[var(--color-surface-2)] rounded-[var(--radius-sm)]" />
            <div className="h-3 w-72 bg-[var(--color-surface-2)] rounded-[var(--radius-sm)] opacity-60" />
          </div>
          <div className="h-8 w-24 bg-[var(--color-surface-2)] rounded-[var(--radius-sm)]" />
        </div>
        {/* Content body blocks */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
          <div className="h-28 bg-[var(--color-surface-1)] rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] p-4 space-y-3">
            <div className="h-4 w-1/3 bg-[var(--color-surface-2)] rounded-[var(--radius-sm)]" />
            <div className="h-8 w-1/2 bg-[var(--color-surface-2)] rounded-[var(--radius-sm)]" />
          </div>
          <div className="h-28 bg-[var(--color-surface-1)] rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] p-4 space-y-3">
            <div className="h-4 w-1/4 bg-[var(--color-surface-2)] rounded-[var(--radius-sm)]" />
            <div className="h-8 w-2/3 bg-[var(--color-surface-2)] rounded-[var(--radius-sm)]" />
          </div>
          <div className="h-28 bg-[var(--color-surface-1)] rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] p-4 space-y-3">
            <div className="h-4 w-1/2 bg-[var(--color-surface-2)] rounded-[var(--radius-sm)]" />
            <div className="h-8 w-1/3 bg-[var(--color-surface-2)] rounded-[var(--radius-sm)]" />
          </div>
        </div>
        <div className="h-64 w-full bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] rounded-[var(--radius-lg)] p-6 space-y-4">
          <div className="h-4 w-1/6 bg-[var(--color-surface-2)] rounded-[var(--radius-sm)]" />
          <div className="h-3 w-full bg-[var(--color-surface-2)] rounded-[var(--radius-sm)]" />
          <div className="h-3 w-full bg-[var(--color-surface-2)] rounded-[var(--radius-sm)]" />
          <div className="h-3 w-2/3 bg-[var(--color-surface-2)] rounded-[var(--radius-sm)]" />
        </div>
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 w-full">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] p-6 rounded-xl space-y-4 animate-pulse">
            <div className="flex justify-between items-center">
              <div className="h-3 w-2/5 bg-[var(--color-surface-2)] rounded" />
              <div className="h-4 w-4 bg-[var(--color-surface-2)] rounded-full" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-5/6 bg-[var(--color-surface-2)] rounded" />
              <div className="h-3 w-full bg-[var(--color-surface-2)] rounded" />
            </div>
            <div className="pt-4 border-t border-[var(--color-border-strong)] flex gap-2">
              <div className="h-5 w-16 bg-[var(--color-surface-2)] rounded" />
              <div className="h-5 w-24 bg-[var(--color-surface-2)] rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] rounded-xl overflow-hidden animate-pulse">
        <div className="h-10 bg-[var(--color-surface-2)] border-b border-[var(--color-border-strong)] flex items-center px-6 gap-4">
          <div className="h-3 w-1/6 bg-[var(--color-surface-3)] rounded" />
          <div className="h-3 w-1/4 bg-[var(--color-surface-3)] rounded" />
          <div className="h-3 w-1/5 bg-[var(--color-surface-3)] rounded" />
          <div className="h-3 w-1/12 bg-[var(--color-surface-3)] rounded ml-auto" />
        </div>
        <div className="divide-y divide-[var(--color-border-strong)]">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="h-12 flex items-center px-6 gap-4">
              <div className="h-3 w-1/5 bg-[var(--color-surface-2)] rounded" />
              <div className="h-3 w-1/3 bg-[var(--color-surface-2)] rounded" />
              <div className="h-3 w-1/6 bg-[var(--color-surface-2)] rounded" />
              <div className="h-6 w-14 bg-[var(--color-surface-2)] rounded-full ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
