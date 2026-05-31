import React from 'react';
import { Shield, Lock, History, Search, Filter, Key, FileWarning, Fingerprint } from 'lucide-react';

export default function AuditGovernance() {
  return (
    <div className="space-y-8 pb-16 font-geist text-[var(--pm-primary)]" style={{ color: 'var(--pm-on-surface)' }}>
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--pm-on-surface)' }}>
            Audit & Governance
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Compliance, Approvals, Role Changes, Audit Trail, and Policy Verification.
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-border bg-surface-2"
          style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 operational-pulse" style={{ boxShadow: '0 0 8px rgba(251,113,133,0.5)' }} />
          <span className="font-mono-pm text-xs uppercase tracking-widest text-[var(--pm-on-surface-variant)]" style={{ color: 'var(--pm-on-surface-variant)' }}>
             GOVERNANCE LEDGER
          </span>
        </div>
      </div>

      {/* KPI metrics bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Security Policies', value: 14, sub: 'Active and enforced', icon: <Shield size={20} />, color: 'var(--pm-primary)' },
          { label: 'Role Changes', value: 3, sub: 'Last 7 days', icon: <Key size={20} />, color: '#60a5fa' },
          { label: 'Audit Logs', value: '45.2K', sub: 'Immutable records', icon: <History size={20} />, color: '#34d399' },
          { label: 'Policy Violations', value: 0, sub: 'Requires immediate action', icon: <FileWarning size={20} />, color: '#fbbf24' }
        ].map((kpi, i) => (
          <div key={i} className="pm-card p-5 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${kpi.color}18`, border: `1px solid ${kpi.color}30`, color: kpi.color }}>
                {kpi.icon}
              </div>
              <span className="font-mono-pm text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>ENFORCED</span>
            </div>
            <div className="text-3xl font-bold tracking-tight" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="text-[11px] font-semibold mt-1 mb-0.5" style={{ color: 'var(--pm-on-surface)' }}>{kpi.label}</div>
            <div className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Primary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Audit Trail */}
        <div className="lg:col-span-8 space-y-6">
          <div className="glass-panel rounded-xl p-6 bg-surface-2 border border-border">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-[var(--pm-primary)]">Immutable Audit Trail</h2>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 bg-surface-3 border border-border px-3 rounded-lg text-xs text-[var(--pm-on-surface-variant)] transition-colors focus-within:border-[var(--pm-primary)]">
                  <Search size={14} />
                  <input type="text" placeholder="Search event hash..." className="bg-transparent border-none outline-none py-1.5 w-32 text-[var(--pm-primary)]" />
                </div>
                <button className="p-1.5 rounded bg-surface-3 border border-border text-[var(--pm-on-surface-variant)] hover:text-[var(--pm-primary)] transition-colors cursor-pointer">
                  <Filter size={14} />
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {/* Log Item 1 */}
              <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl transition-all gap-4 bg-surface-2 border border-border"
                style={{ background: 'var(--pm-surface-high)', borderColor: 'rgba(70,69,84,0.3)' }}>
                <div className="flex items-start gap-4">
                  <div className="mt-1 p-2 bg-rose-500/10 text-rose-400 rounded border border-rose-500/20">
                    <Key size={18} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Role Escalation Event</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-mono-pm bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">ACCESS CONTROL</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 font-mono-pm text-[11px] text-[var(--pm-on-surface-variant)]">
                      <span>ACTOR: <strong className="text-[var(--pm-primary)]">Super Admin</strong></span>
                      <span>•</span>
                      <span>TIMESTAMP: <strong className="text-[var(--pm-on-surface)]">2024-10-15 14:32:01 UTC</strong></span>
                    </div>
                    <p className="text-xs mt-2" style={{ color: 'var(--pm-on-surface-variant)' }}>
                      User ID 4892A was promoted to Project Manager for workspace 'Alpha'.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0 self-start md:self-center">
                  <button className="px-4 py-2 rounded-lg text-xs font-mono-pm uppercase tracking-widest bg-surface-3 hover:bg-surface-highest text-[var(--pm-on-surface)] border border-border transition-all cursor-pointer">
                    Inspect Trace
                  </button>
                </div>
              </div>

              {/* Log Item 2 */}
              <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl transition-all gap-4 bg-surface-2 border border-border"
                style={{ background: 'var(--pm-surface-high)', borderColor: 'rgba(70,69,84,0.3)' }}>
                <div className="flex items-start gap-4">
                  <div className="mt-1 p-2 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">
                    <Fingerprint size={18} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--pm-on-surface)' }}>System Integrity Verified</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-mono-pm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">SYSTEM HEALTH</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 font-mono-pm text-[11px] text-[var(--pm-on-surface-variant)]">
                      <span>ACTOR: <strong className="text-[var(--pm-primary)]">System Automations</strong></span>
                      <span>•</span>
                      <span>TIMESTAMP: <strong className="text-[var(--pm-on-surface)]">2024-10-15 00:00:00 UTC</strong></span>
                    </div>
                    <p className="text-xs mt-2" style={{ color: 'var(--pm-on-surface-variant)' }}>
                      Daily scheduled cryptographic verification of the Governance Ledger completed successfully.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0 self-start md:self-center">
                  <button className="px-4 py-2 rounded-lg text-xs font-mono-pm uppercase tracking-widest bg-surface-3 hover:bg-surface-highest text-[var(--pm-on-surface)] border border-border transition-all cursor-pointer">
                    Inspect Trace
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Intelligence Surface */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-panel rounded-xl p-6 bg-surface-2 border border-border">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-[var(--pm-primary)]">Policy Verification</h2>
              <Lock size={16} className="text-rose-400" />
            </div>
            
            <div className="p-4 rounded-lg bg-surface-3 border border-border text-center flex flex-col items-center justify-center min-h-[150px] gap-3">
               <Shield size={32} className="text-[var(--pm-on-surface-variant)] opacity-50" />
               <p className="text-xs text-[var(--pm-on-surface-variant)]">System meets SOC2 and internal corporate compliance mandates.</p>
               <span className="font-mono-pm text-[9px] uppercase text-emerald-400 tracking-widest border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded">COMPLIANT</span>
            </div>

            <div className="mt-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider font-mono-pm text-[var(--pm-on-surface-variant)] mb-2">Automated Checks</h3>
              
              <div className="flex items-center justify-between p-2 rounded hover:bg-surface-3 transition-colors text-xs border border-transparent hover:border-border cursor-pointer">
                <span className="truncate max-w-[200px] text-[var(--pm-primary)]">RBAC Violation Scan</span>
                <span className="text-[10px] text-emerald-400 font-mono-pm bg-emerald-500/10 border border-emerald-500/20 px-1.5 rounded">PASSED</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded hover:bg-surface-3 transition-colors text-xs border border-transparent hover:border-border cursor-pointer">
                <span className="truncate max-w-[200px] text-[var(--pm-primary)]">Orphaned Resources Sweep</span>
                <span className="text-[10px] text-amber-400 font-mono-pm bg-amber-500/10 border border-amber-500/20 px-1.5 rounded">WARNING</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
