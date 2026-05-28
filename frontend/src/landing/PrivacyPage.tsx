import React from 'react';

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface font-sans">
      <header className="w-full h-16 flex items-center px-6 lg:px-12 border-b border-white/10 sticky top-0 bg-surface-container-lowest/80 backdrop-blur-md z-50">
        <a href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
            <span className="text-on-primary font-bold text-xs">R</span>
          </div>
          <span className="font-semibold tracking-tight">Resolve PM</span>
        </a>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 lg:py-24 space-y-8">
        <div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Privacy Policy</h1>
          <p className="text-on-surface-variant font-mono text-sm opacity-80">Effective Date: May 28, 2026</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Introduction</h2>
          <p className="text-on-surface-variant leading-relaxed">
            Resolve PM is committed to protecting user privacy while providing advanced project orchestration tools.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Google Data Usage</h2>
          <p className="text-on-surface-variant leading-relaxed">
            We access Google Calendar data strictly to synchronize project deadlines, identify user availability for capacity planning, and update project-related events when timelines shift.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Limited Use Disclosure</h2>
          <p className="text-on-surface-variant leading-relaxed">
            Resolve PM’s use and transfer of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes" target="_blank" rel="noreferrer" className="text-primary hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Data Protection</h2>
          <p className="text-on-surface-variant leading-relaxed">
            We do not sell user data to third parties.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Contact</h2>
          <p className="text-on-surface-variant leading-relaxed">
            For privacy inquiries, contact <a href="mailto:resolve.pm.dev@gmail.com" className="text-primary hover:underline">resolve.pm.dev@gmail.com</a>.
          </p>
        </section>
      </main>

      <footer className="w-full py-8 px-6 lg:px-12 flex flex-col md:flex-row justify-between items-center border-t border-white/5 mt-12">
        <div className="flex flex-col items-center md:items-start gap-2 mb-6 md:mb-0">
          <span className="font-semibold text-on-surface">Resolve PM</span>
          <p className="text-sm text-on-surface-variant opacity-60">© 2026 Resolve PM. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
