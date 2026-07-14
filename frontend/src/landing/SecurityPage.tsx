import React from 'react';
import { Shield, Lock, Server, Key, FileText, Database } from 'lucide-react';

export function SecurityPage() {
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

      <main className="max-w-4xl mx-auto px-6 py-12 lg:py-24 space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">Security & Infrastructure Disclosure</h1>
          <p className="text-[#a1a1aa] max-w-2xl mx-auto">
            Resolve PM is engineered for absolute zero-trust environments. With flexible deployment options, your security perimeter is completely under your control.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] p-6 rounded-xl border border-[var(--border-soft)]">
            <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-4">
              <Database className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Isolated Architecture</h3>
            <p className="text-[#a1a1aa] leading-relaxed text-sm">
              Deploy Resolve PM behind your corporate firewall. We do not require inbound firewall exceptions, and the system can operate indefinitely in fully air-gapped environments once the offline license is verified.
            </p>
          </div>

          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] p-6 rounded-xl border border-[var(--border-soft)]">
            <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Encryption Standards</h3>
            <p className="text-[#a1a1aa] leading-relaxed text-sm">
              All credentials, API keys, and sensitive tokens are encrypted at rest using AES-256-GCM. We strongly recommend configuring your PostgreSQL deployment with transparent data encryption (TDE) for full-disk security.
            </p>
          </div>

          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] p-6 rounded-xl border border-[var(--border-soft)]">
            <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Role-Based Access</h3>
            <p className="text-[#a1a1aa] leading-relaxed text-sm">
              Our capability-driven governance engine ensures that users only access what they strictly need. From Super Admins to external viewers, permissions are continuously verified at both the UI and workspace data secure access rules.
            </p>
          </div>

          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] p-6 rounded-xl border border-[var(--border-soft)]">
            <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Immutable Audit Logging</h3>
            <p className="text-[#a1a1aa] leading-relaxed text-sm">
              Every significant action—from role modifications to timeline drifts—is recorded in a cryptographic audit ledger. The system aggregates these logs for compliance reporting, ensuring non-repudiation of operational events.
            </p>
          </div>
        </div>

        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] p-8 rounded-xl border border-[var(--border-soft)] bg-black/40">
          <h2 className="text-2xl font-bold text-white mb-4">Security Reporting</h2>
          <p className="text-[#a1a1aa] leading-relaxed mb-6">
            If you discover a vulnerability in the Resolve PM source code or architecture, we request that you confidentially disclose it to us before publicizing it. We treat security reports as highest priority.
          </p>
          <a href="mailto:security@resolvepm.com" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors">
            <Key className="w-4 h-4" />
            Contact Security Team
          </a>
        </div>
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
