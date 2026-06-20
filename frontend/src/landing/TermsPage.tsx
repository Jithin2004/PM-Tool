import React from 'react';

export function TermsPage() {
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
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-white">Terms of Service</h1>
          <p className="text-[#a1a1aa] font-mono text-sm opacity-80 mb-4">Effective Date: May 28, 2026</p>
          <div className="bg-orange-500/10 border border-orange-500/30 text-orange-400 p-4 rounded text-sm font-semibold">
            WARNING: Legal review required before commercial distribution.
          </div>
        </div>

        <section className="space-y-4 premium-panel p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">1. One-Time Software License</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            Resolve PM is licensed on a perpetual, one-time payment basis. You are purchasing a license to deploy and operate the software indefinitely. This is not a monthly SaaS subscription. You are granted a non-exclusive, non-transferable license to host the software for your internal organizational use.
          </p>
        </section>

        <section className="space-y-4 premium-panel p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">2. Product Activation & Workspace Ownership</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            Upon purchase, you will receive a cryptographically signed Product Key. This key is required to initialize your workspace. You retain complete ownership of the data, infrastructure, and operating environment of your workspace. Resolve PM HQ claims no ownership over your operational data.
          </p>
        </section>

        <section className="space-y-4 premium-panel p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">3. Administrator Responsibility</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            With flexible deployment options, your Workspace Owner / Super Administrator is entirely responsible for backing up data, securing infrastructure access, applying operating system updates, and provisioning users. Resolve PM HQ cannot recover deleted data or lost passwords from your private instance.
          </p>
        </section>

        <section className="space-y-4 premium-panel p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">4. Support & Update Terms</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            Your initial purchase includes 12 months of guaranteed software updates, security patches, and standard email support. After 12 months, the software will continue to function in perpetuity. However, access to future feature updates or technical support may require an optional maintenance renewal.
          </p>
        </section>

        <section className="space-y-4 premium-panel p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">5. Acceptable Use</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            You agree not to reverse engineer, decompile, or attempt to extract the source code of the proprietary portions of Resolve PM. You may not resell, rent, or distribute the software or your Product Key to external third parties outside your organization.
          </p>
        </section>

        <section className="space-y-4 premium-panel p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">6. Limitation of Liability</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            In no event shall Resolve PM HQ be liable for any indirect, incidental, special, or consequential damages, including but not limited to loss of profits, data, or business interruption, arising out of the use or inability to use the software. Our maximum liability shall not exceed the original purchase price of the license.
          </p>
        </section>

      </main>

      <footer className="w-full py-8 px-6 lg:px-12 flex flex-col md:flex-row justify-between items-center border-t border-[var(--border-soft)] mt-12 bg-black/30">
        <div className="flex flex-col items-center md:items-start gap-2 mb-6 md:mb-0">
          <span className="font-semibold text-white">Resolve PM</span>
          <p className="text-sm text-[#a1a1aa] opacity-60">© 2026 Resolve PM. All rights reserved.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-6">
          <a href="/privacy" className="font-body-sm text-body-sm text-[#a1a1aa] hover:text-white transition-all">Privacy</a>
          <a href="mailto:contact@resolvepm.app" className="font-body-sm text-body-sm text-[#a1a1aa] hover:text-white transition-all">Contact</a>
        </div>
      </footer>
    </div>
  );
}
