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
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-white">Enterprise License Agreement</h1>
          <p className="text-[#a1a1aa] font-mono text-sm opacity-80">Effective Date: May 28, 2026</p>
        </div>

        <section className="space-y-4 premium-panel p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">1. Software License</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            Resolve PM is provided as perpetual enterprise software. Upon purchase of a license, the customer is granted a non-exclusive, non-transferable, perpetual right to install and use the software within their organization. This is not a Software-as-a-Service (SaaS) subscription.
          </p>
        </section>

        <section className="space-y-4 premium-panel p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">2. Deployment and Ownership</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            The customer is solely responsible for the deployment, hosting, and maintenance of the Resolve PM platform. All data generated within the software remains the exclusive property of the customer. Resolve PM does not have access to, nor does it monitor, customer data.
          </p>
        </section>

        <section className="space-y-4 premium-panel p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">3. Backup Responsibility</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            Because Resolve PM operates as an isolated enterprise application, the customer assumes full liability for data retention, disaster recovery, and database backups. Resolve PM HQ provides the tools to export data but is not liable for data loss due to hardware failure, corruption, or improper backup practices by the customer's IT administration.
          </p>
        </section>

        <section className="space-y-4 premium-panel p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">4. Support Coverage</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            Every enterprise license includes 12 months of prioritized support and access to software updates. Upon expiration of the support coverage period, the software will continue to function perpetually; however, access to new feature releases and direct technical support will require a support renewal contract.
          </p>
        </section>

        <section className="space-y-4 premium-panel p-6 rounded-xl">
          <h2 className="text-xl font-semibold text-white">5. Limitation of Liability</h2>
          <p className="text-[#a1a1aa] leading-relaxed">
            Resolve PM is not liable for indirect, consequential, or operational damages resulting from the use of the software. The maximum liability is limited to the total amount paid by the customer for the software license.
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
