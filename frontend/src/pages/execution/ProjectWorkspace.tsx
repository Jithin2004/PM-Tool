import React from 'react';
import { Target, GitBranch, CalendarDays, CheckCircle2, Search, Filter, Navigation } from 'lucide-react';

export default function ProjectWorkspace() {
  return (
    <div className="space-y-8 pb-16 font-geist text-[var(--pm-primary)]" style={{ color: 'var(--pm-on-surface)' }}>
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--pm-on-surface)' }}>
            Strategic Oversight
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Milestones, Dependencies, Deliverables, and Execution Progress.
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-border bg-surface-2"
          style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 operational-pulse" style={{ boxShadow: '0 0 8px rgba(52,211,153,0.5)' }} />
          <span className="font-mono-pm text-xs uppercase tracking-widest text-[var(--pm-on-surface-variant)]" style={{ color: 'var(--pm-on-surface-variant)' }}>
             EXECUTION TIMELINE
          </span>
        </div>
      </div>

      {/* KPI metrics bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Active Milestones', value: 8, sub: 'In progress', icon: <Target size={20} />, color: 'var(--pm-primary)' },
          { label: 'Dependencies Tracked', value: 34, sub: 'Cross-functional', icon: <GitBranch size={20} />, color: '#60a5fa' },
          { label: 'Deliverables Completed', value: 156, sub: 'This quarter', icon: <CheckCircle2 size={20} />, color: '#34d399' },
          { label: 'Schedule Variance', value: '+1.2%', sub: 'Ahead of schedule', icon: <CalendarDays size={20} />, color: '#fbbf24' }
        ].map((kpi, i) => (
          <div key={i} className="pm-card p-5 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${kpi.color}18`, border: `1px solid ${kpi.color}30`, color: kpi.color }}>
                {kpi.icon}
              </div>
              <span className="font-mono-pm text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>ACTIVE</span>
            </div>
            <div className="text-3xl font-bold tracking-tight" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="text-[11px] font-semibold mt-1 mb-0.5" style={{ color: 'var(--pm-on-surface)' }}>{kpi.label}</div>
            <div className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Primary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Execution Timeline */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-6 bg-surface-2 border border-border">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-[var(--pm-primary)]">Execution Timeline</h2>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 bg-surface-3 border border-border px-3 rounded-lg text-xs text-[var(--pm-on-surface-variant)] transition-colors focus-within:border-[var(--pm-primary)]">
                  <Search size={14} />
                  <input type="text" placeholder="Search milestone..." className="bg-transparent border-none outline-none py-1.5 w-32 text-[var(--pm-primary)]" />
                </div>
                <button className="p-1.5 rounded bg-surface-3 border border-border text-[var(--pm-on-surface-variant)] hover:text-[var(--pm-primary)] transition-colors cursor-pointer">
                  <Filter size={14} />
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {/* Milestone 1 */}
              <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl transition-all gap-4 bg-surface-2 border border-border"
                style={{ background: 'var(--pm-surface-high)', borderColor: 'rgba(70,69,84,0.3)' }}>
                <div className="flex items-start gap-4">
                  <div className="mt-1 p-2 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">
                    <Target size={18} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Alpha Release Candidate</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-mono-pm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">ON TRACK</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 font-mono-pm text-[11px] text-[var(--pm-on-surface-variant)]">
                      <span>OWNER: <strong className="text-[var(--pm-primary)]">Engineering Core</strong></span>
                      <span>•</span>
                      <span>DUE: <strong className="text-[var(--pm-on-surface)]">Nov 15, 2024</strong></span>
                    </div>
                    <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden mt-3">
                      <div className="bg-emerald-400 h-full rounded-full" style={{ width: '85%' }}></div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0 self-start md:self-center">
                  <button className="px-4 py-2 rounded-lg text-xs font-mono-pm uppercase tracking-widest bg-surface-3 hover:bg-surface-highest text-[var(--pm-on-surface)] border border-border transition-all cursor-pointer">
                    View Details
                  </button>
                </div>
              </div>

              {/* Milestone 2 */}
              <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl transition-all gap-4 bg-surface-2 border border-border"
                style={{ background: 'var(--pm-surface-high)', borderColor: 'rgba(70,69,84,0.3)' }}>
                <div className="flex items-start gap-4">
                  <div className="mt-1 p-2 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">
                    <Target size={18} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Database Migration Phase 2</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-mono-pm bg-amber-500/10 text-amber-400 border border-amber-500/20">AT RISK</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 font-mono-pm text-[11px] text-[var(--pm-on-surface-variant)]">
                      <span>OWNER: <strong className="text-[var(--pm-primary)]">Data Platform</strong></span>
                      <span>•</span>
                      <span>DUE: <strong className="text-[var(--pm-on-surface)]">Dec 01, 2024</strong></span>
                    </div>
                    <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden mt-3">
                      <div className="bg-amber-400 h-full rounded-full" style={{ width: '45%' }}></div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0 self-start md:self-center">
                  <button className="px-4 py-2 rounded-lg text-xs font-mono-pm uppercase tracking-widest bg-surface-3 hover:bg-surface-highest text-[var(--pm-on-surface)] border border-border transition-all cursor-pointer">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Intelligence Surface */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-6 bg-surface-2 border border-border">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-[var(--pm-primary)]">Dependency Map</h2>
              <Navigation size={16} className="text-emerald-400" />
            </div>
            
            <div className="p-4 rounded-lg bg-surface-3 border border-border text-center flex flex-col items-center justify-center min-h-[150px] gap-3">
               <GitBranch size={32} className="text-[var(--pm-on-surface-variant)] opacity-50" />
               <p className="text-xs text-[var(--pm-on-surface-variant)]">Interactive Gantt and PERT charts will load here.</p>
               <span className="font-mono-pm text-[9px] uppercase text-emerald-400 tracking-widest border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded">AUTO-SCHEDULED</span>
            </div>

            <div className="mt-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider font-mono-pm text-[var(--pm-on-surface-variant)] mb-2">Critical Path Risks</h3>
              
              <div className="flex items-center justify-between p-2 rounded hover:bg-surface-3 transition-colors text-xs border border-transparent hover:border-border cursor-pointer">
                <span className="truncate max-w-[200px] text-[var(--pm-primary)]">Legacy API Deprecation</span>
                <span className="text-[10px] text-red-400 font-mono-pm bg-red-500/10 border border-[var(--signal-critical)] bg-[var(--signal-critical-bg)]/20 px-1.5 rounded">BLOCKED</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded hover:bg-surface-3 transition-colors text-xs border border-transparent hover:border-border cursor-pointer">
                <span className="truncate max-w-[200px] text-[var(--pm-primary)]">Security Audit Sign-off</span>
                <span className="text-[10px] text-amber-400 font-mono-pm bg-amber-500/10 border border-amber-500/20 px-1.5 rounded">DELAYED</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
