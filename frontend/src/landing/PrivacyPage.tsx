import React from 'react';

export function PrivacyPage() {
  return (
    <div className="min-h-screen  text-[#e2e2e5] font-sans">
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
          <h2 className="text-xl font-semibold text-white">Introduction</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            Resolve PM is committed to protecting user privacy while providing advanced project orchestration tools.
          </p>
        </section>

        <section className="space-y-4 premium-panel p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">Google Data Usage</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            We access Google Calendar data strictly to synchronize project deadlines, identify user availability for capacity planning, and update project-related events when timelines shift.
          </p>
        </section>

        <section className="space-y-4 premium-panel p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">Limited Use Disclosure</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            Resolve PM’s use and transfer of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes" target="_blank" rel="noreferrer" className="text-purple-400 hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements.
          </p>
        </section>

        <section className="space-y-4 premium-panel p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">Data Protection</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            We do not sell user data to third parties.
          </p>
        </section>

        <section className="space-y-4 premium-panel p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">Contact</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            For privacy inquiries, contact <a href="mailto:resolve.pm.dev@gmail.com" className="text-purple-400 hover:underline">resolve.pm.dev@gmail.com</a>.
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
