import React from 'react';
import { BrainCircuit, AlertTriangle, CheckCircle2, Clock, Filter, Shield } from 'lucide-react';

export default function DecisionCenter() {
  return (
    <div className="space-y-8 pb-16 font-geist text-[var(--pm-primary)]" style={{ color: 'var(--pm-on-surface)' }}>
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--pm-on-surface)' }}>
            Decision Center
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Governance, Approvals, Escalations, and Executive Decisions.
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-border bg-surface-2"
          style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 operational-pulse" style={{ boxShadow: '0 0 8px rgba(45,212,191,0.5)' }} />
          <span className="font-mono-pm text-xs uppercase tracking-widest text-[var(--pm-on-surface-variant)]" style={{ color: 'var(--pm-on-surface-variant)' }}>
             EXECUTIVE PIPELINE
          </span>
        </div>
      </div>

      {/* KPI metrics bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Pending Approvals', value: 3, sub: 'Awaiting Sign-off', icon: <CheckCircle2 size={20} />, color: 'var(--pm-primary)' },
          { label: 'Active Escalations', value: 1, sub: 'Requires immediate action', icon: <AlertTriangle size={20} />, color: 'var(--pm-error)' },
          { label: 'Resolved Decisions', value: 42, sub: 'Last 30 days', icon: <BrainCircuit size={20} />, color: '#34d399' },
          { label: 'Avg Resolution Time', value: '1.2d', sub: 'From initiation to approval', icon: <Clock size={20} />, color: '#60a5fa' }
        ].map((kpi, i) => (
          <div key={i} className="pm-card p-5 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${kpi.color}18`, border: `1px solid ${kpi.color}30`, color: kpi.color }}>
                {kpi.icon}
              </div>
              <span className="font-mono-pm text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>LIVE</span>
            </div>
            <div className="text-3xl font-bold tracking-tight" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="text-[11px] font-semibold mt-1 mb-0.5" style={{ color: 'var(--pm-on-surface)' }}>{kpi.label}</div>
            <div className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Primary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Decision Pipeline */}
        <div className="lg:col-span-8 space-y-6">
          <div className="glass-panel rounded-xl p-6 bg-surface-2 border border-border">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-[var(--pm-primary)]">Decision Pipeline</h2>
              <div className="flex gap-2">
                <button className="p-1.5 rounded bg-surface-3 border border-border text-[var(--pm-on-surface-variant)] hover:text-[var(--pm-primary)] transition-colors cursor-pointer">
                  <Filter size={14} />
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {/* Example Escalation */}
              <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl transition-all gap-4 bg-surface-2 border border-border"
                style={{ background: 'rgba(239, 68, 68, 0.04)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Resource Allocation Override</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-mono-pm bg-red-500/10 text-red-400 border border-red-500/20">ESCALATION</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 font-mono-pm text-[11px] text-[var(--pm-on-surface-variant)]">
                    <span>INITIATOR: <strong className="text-[var(--pm-primary)]">John Doe</strong></span>
                    <span>•</span>
                    <span>PROJECT: <strong className="text-[var(--pm-primary)]">Phoenix Backend Rebuild</strong></span>
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--pm-on-surface-variant)' }}>
                    Project requires 2 additional senior backend engineers to meet the revised client deadline.
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button className="px-4 py-2 rounded-lg text-xs font-mono-pm uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all cursor-pointer">
                    Review Request
                  </button>
                </div>
              </div>

              {/* Example Approval */}
              <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl transition-all gap-4 bg-surface-2 border border-border"
                style={{ background: 'var(--pm-surface-high)', borderColor: 'rgba(70,69,84,0.3)' }}>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Architectural Shift: Monolith to Microservices</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-mono-pm bg-amber-500/10 text-amber-400 border border-amber-500/20">PENDING APPROVAL</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 font-mono-pm text-[11px] text-[var(--pm-on-surface-variant)]">
                    <span>INITIATOR: <strong className="text-[var(--pm-primary)]">Tech Council</strong></span>
                    <span>•</span>
                    <span>IMPACT: <strong className="text-amber-400">HIGH</strong></span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button className="px-4 py-2 rounded-lg text-xs font-mono-pm uppercase tracking-widest bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-all cursor-pointer">
                    Cast Vote
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
              <h2 className="text-base font-semibold text-[var(--pm-primary)]">Governance Ledger</h2>
              <Shield size={16} className="text-indigo-400" />
            </div>
            
            <div className="space-y-4">
              <div className="p-3 rounded-lg border bg-surface-3 border-border flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-[var(--pm-primary)]">Q3 Budget Expansion</span>
                <div className="flex items-center justify-between text-[10px] font-mono-pm text-[var(--pm-on-surface-variant)]">
                  <span>STATUS: <strong className="text-emerald-400">APPROVED</strong></span>
                  <span>AUG 12</span>
                </div>
                <p className="text-[10px] text-[var(--pm-on-surface-variant)]">By CEO & CFO Council</p>
              </div>

              <div className="p-3 rounded-lg border bg-surface-3 border-border flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-[var(--pm-primary)]">Vendor Selection: AWS</span>
                <div className="flex items-center justify-between text-[10px] font-mono-pm text-[var(--pm-on-surface-variant)]">
                  <span>STATUS: <strong className="text-emerald-400">APPROVED</strong></span>
                  <span>AUG 05</span>
                </div>
                <p className="text-[10px] text-[var(--pm-on-surface-variant)]">By Lead Architect</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
