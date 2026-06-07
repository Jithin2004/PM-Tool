import React from 'react';
import { PRODUCT_NAME, PRODUCT_PROMISE } from '../../constants/product';

interface ResolveLayoutProps {
  eyebrow?: string;
  children: React.ReactNode;
}

export function ResolveLayout({ eyebrow, children }: ResolveLayoutProps) {
  return (
    <div className="flex-1 flex flex-col font-sans">
      <header className="border-b border-[var(--border-soft)] px-6 py-4 bg-surface-glass backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.25em] text-[var(--text-tertiary)]">{eyebrow || PRODUCT_NAME}</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)]">{PRODUCT_NAME}</h1>
          </div>
          <p className="hidden text-sm text-[var(--text-secondary)] sm:block">{PRODUCT_PROMISE}</p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8 w-full">{children}</main>
    </div>
  );
}
