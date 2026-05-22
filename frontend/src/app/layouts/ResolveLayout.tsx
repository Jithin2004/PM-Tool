import React from 'react';
import { PRODUCT_NAME, PRODUCT_PROMISE } from '../../constants/product';

interface ResolveLayoutProps {
  eyebrow?: string;
  children: React.ReactNode;
}

export function ResolveLayout({ eyebrow, children }: ResolveLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.25em] text-white/50">{eyebrow || PRODUCT_NAME}</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">{PRODUCT_NAME}</h1>
          </div>
          <p className="hidden text-sm text-white/60 sm:block">{PRODUCT_PROMISE}</p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
