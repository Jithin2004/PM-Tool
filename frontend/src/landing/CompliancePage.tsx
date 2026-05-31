import React from 'react';

export function CompliancePage() {
  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface font-sans">
      <header className="w-full h-16 flex items-center px-6 lg:px-12 border-b border-[var(--pm-border)] dark:border-white/10 sticky top-0 bg-surface-container-lowest/80 backdrop-blur-md z-50">
        <a href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
            <span className="text-on-primary font-bold text-xs">R</span>
          </div>
          <span className="font-semibold tracking-tight">Resolve PM</span>
        </a>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 lg:py-24 space-y-8">
        <div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Compliance Statement</h1>
          <p className="text-on-surface-variant font-mono text-sm opacity-80">Effective Date: May 28, 2026</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Data Governance</h2>
          <p className="text-on-surface-variant leading-relaxed">
            Resolve PM adheres to strict data governance protocols to ensure all project information is handled with transparency.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Google API Compliance</h2>
          <p className="text-on-surface-variant leading-relaxed">
            We maintain 100% compliance with the Google API Services User Data Policy, specifically the "Limited Use" requirements for the Google Calendar API.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Regional Standards</h2>
          <p className="text-on-surface-variant leading-relaxed">
            While currently in development, our roadmap includes alignment with global data protection standards (such as GDPR/CCPA logic) to ensure international reliability.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Auditability</h2>
          <p className="text-on-surface-variant leading-relaxed">
            Every system interaction is logged in our internal audit ledger to ensure accountability for all automated scheduling changes.
          </p>
        </section>
      </main>

      <footer className="w-full py-8 px-6 lg:px-12 flex flex-col md:flex-row justify-between items-center border-t border-[var(--pm-border)] dark:border-white/5 mt-12">
        <div className="flex flex-col items-center md:items-start gap-2 mb-6 md:mb-0">
          <span className="font-semibold text-on-surface">Resolve PM</span>
          <p className="text-sm text-on-surface-variant opacity-60">© 2026 Resolve PM. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
