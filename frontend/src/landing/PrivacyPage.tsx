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
        <div className="premium-panel p-8 rounded-xl border border-[var(--border-soft)]">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-white">Privacy Policy</h1>
          <p className="text-[#a1a1aa] font-mono text-sm opacity-80">Effective Date: May 28, 2026</p>
        </div>

        <section className="space-y-4 premium-panel p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">1. Data Ownership & Self-Hosting</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            Resolve PM operates as self-hosted, perpetual enterprise software. You retain 100% ownership and control over your project data, employee metrics, and system configuration. Because the software runs within your isolated environment, Resolve PM HQ cannot access, view, or harvest your operational data.
          </p>
        </section>

        <section className="space-y-4 premium-panel p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">2. License Verification Telemetry</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            The software performs a lightweight, periodic background ping to our licensing servers strictly to verify the cryptographic authenticity of your product key. This ping transmits your Product Key, an anonymous hardware fingerprint, and the timestamp. No project data, personally identifiable information, or usage analytics are transmitted during this check.
          </p>
        </section>

        <section className="space-y-4 premium-panel p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">3. Third-Party Integrations</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            If you enable third-party integrations (such as Google Calendar, Slack, or GitHub), data exchange occurs directly between your Resolve PM instance and the third-party provider's API. Resolve PM HQ does not proxy or intercept this communication. You are subject to the privacy policies of those third-party services.
          </p>
        </section>

        <section className="space-y-4 premium-panel p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">4. Diagnostic Support Packages</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            In the event of a system failure, your Super Administrator may choose to escalate a support ticket to Resolve PM HQ. This action explicitly bundles an anonymized diagnostic package containing error stack traces and configuration states. The administrator may review this package prior to transmission. We use this data strictly for troubleshooting your specific issue.
          </p>
        </section>
      </main>

      <footer className="w-full py-8 px-6 lg:px-12 flex flex-col md:flex-row justify-between items-center border-t border-[var(--border-soft)] mt-12 bg-black/30">
        <div className="flex flex-col items-center md:items-start gap-2 mb-6 md:mb-0">
          <span className="font-semibold text-white">Resolve PM</span>
          <p className="text-sm text-[#a1a1aa] opacity-60">© 2026 Resolve PM. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
