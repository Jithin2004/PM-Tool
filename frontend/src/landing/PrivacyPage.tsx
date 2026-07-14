import React from 'react';

export function PrivacyPage() {
  return (
    <div className="min-h-screen text-[#e2e2e5] font-sans">
      <header className="w-full h-16 flex items-center px-6 lg:px-12 border-b border-[var(--border-soft)] sticky top-0 bg-[#050712]/50 backdrop-blur-md z-50">
        <a href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[rgba(124,58,237,0.18)] border border-purple-500/30 flex items-center justify-center">
            <span className="text-purple-400 font-bold text-xs">R</span>
          </div>
          <span className="font-semibold tracking-tight text-white">Resolve PM</span>
        </a>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 lg:py-24 space-y-8 selectable-content">
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] p-8 rounded-xl border border-[var(--border-soft)]">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-white">Privacy Policy</h1>
          <p className="text-[#a1a1aa] font-mono text-sm opacity-80 mb-4">Effective Date: May 28, 2026</p>
          <div className="bg-orange-500/10 border border-orange-500/30 text-orange-400 p-4 rounded text-sm font-semibold">
            WARNING: Legal review required before commercial distribution.
          </div>
        </div>

        <section className="space-y-4 bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">1. Flexible Deployment & Private Workspace Architecture</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            Resolve PM is provided as flexible, perpetual enterprise software. Because the software runs entirely within your isolated workspace data and infrastructure, you retain 100% ownership and control over your data. Resolve PM HQ cannot access, view, intercept, or harvest your operational data.
          </p>
        </section>

        <section className="space-y-4 bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">2. Account Information & Authentication</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            Account provisioning, authentication tokens, and profile management are handled exclusively by your configured Identity Provider (IdP) and your instance of the Resolve PM workspace data. We do not store, process, or proxy your credentials.
          </p>
        </section>

        <section className="space-y-4 bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">3. Operational Data & Files</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            All operational data—including projects, tasks, comments, financial metrics, and uploaded files—reside permanently on your secure storage buckets and workspace data. Your instance's secure access rules enforce strict data isolation between your users. No project data is ever transmitted to Resolve PM HQ.
          </p>
        </section>

        <section className="space-y-4 bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">4. Audit Logs</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            The application maintains an immutable internal audit ledger of actions performed by users. This is retained on your own workspace data strictly for your security and compliance review. It is not shared externally.
          </p>
        </section>

        <section className="space-y-4 bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">5. Retention and Deletion Rights</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            Since you own the infrastructure, you dictate your own data retention and deletion policies. The workspace administrator has the full authority to wipe the workspace data, archive records, or destroy instances without interference or retention policies enforced by Resolve PM HQ.
          </p>
        </section>

      </main>

      <footer className="w-full py-8 px-6 lg:px-12 flex flex-col md:flex-row justify-between items-center border-t border-[var(--border-soft)] mt-12 bg-black/30">
        <div className="flex flex-col items-center md:items-start gap-2 mb-6 md:mb-0">
          <span className="font-semibold text-white">Resolve PM</span>
          <p className="text-sm text-[#a1a1aa] opacity-60">© 2026 Resolve PM. All rights reserved.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-6">
          <a href="/terms" className="font-body-sm text-body-sm text-[#a1a1aa] hover:text-white transition-all">Terms</a>
          <a href="mailto:contact@resolvepm.app" className="font-body-sm text-body-sm text-[#a1a1aa] hover:text-white transition-all">Contact</a>
        </div>
      </footer>
    </div>
  );
}
