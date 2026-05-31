import React from 'react';
import { BookOpen, FileText, Network, Search, Filter, History } from 'lucide-react';

export default function KnowledgeHub() {
  return (
    <div className="space-y-8 pb-16 font-geist text-[var(--pm-primary)]" style={{ color: 'var(--pm-on-surface)' }}>
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--pm-on-surface)' }}>
            Knowledge Hub
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Institutional Memory, Documentation, Standards, and Processes.
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-border bg-surface-2"
          style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 operational-pulse" style={{ boxShadow: '0 0 8px rgba(96,165,250,0.5)' }} />
          <span className="font-mono-pm text-xs uppercase tracking-widest text-[var(--pm-on-surface-variant)]" style={{ color: 'var(--pm-on-surface-variant)' }}>
             INSTITUTIONAL GRAPH
          </span>
        </div>
      </div>

      {/* KPI metrics bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Published Standards', value: 124, sub: 'Verified by Governance', icon: <BookOpen size={20} />, color: 'var(--pm-primary)' },
          { label: 'Active Processes', value: 38, sub: 'Currently utilized', icon: <FileText size={20} />, color: '#60a5fa' },
          { label: 'Network Nodes', value: 892, sub: 'Connected artifacts', icon: <Network size={20} />, color: '#34d399' },
          { label: 'Recent Updates', value: 12, sub: 'Last 7 days', icon: <History size={20} />, color: '#fbbf24' }
        ].map((kpi, i) => (
          <div key={i} className="pm-card p-5 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${kpi.color}18`, border: `1px solid ${kpi.color}30`, color: kpi.color }}>
                {kpi.icon}
              </div>
              <span className="font-mono-pm text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>INDEXED</span>
            </div>
            <div className="text-3xl font-bold tracking-tight" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="text-[11px] font-semibold mt-1 mb-0.5" style={{ color: 'var(--pm-on-surface)' }}>{kpi.label}</div>
            <div className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Primary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Knowledge Repository */}
        <div className="lg:col-span-8 space-y-6">
          <div className="glass-panel rounded-xl p-6 bg-surface-2 border border-border">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-[var(--pm-primary)]">Documentation & Standards</h2>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 bg-surface-3 border border-border px-3 rounded-lg text-xs text-[var(--pm-on-surface-variant)] transition-colors focus-within:border-[var(--pm-primary)]">
                  <Search size={14} />
                  <input type="text" placeholder="Search standard..." className="bg-transparent border-none outline-none py-1.5 w-32 text-[var(--pm-primary)]" />
                </div>
                <button className="p-1.5 rounded bg-surface-3 border border-border text-[var(--pm-on-surface-variant)] hover:text-[var(--pm-primary)] transition-colors cursor-pointer">
                  <Filter size={14} />
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {/* Document Item */}
              <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl transition-all gap-4 bg-surface-2 border border-border"
                style={{ background: 'var(--pm-surface-high)', borderColor: 'rgba(70,69,84,0.3)' }}>
                <div className="flex items-start gap-4">
                  <div className="mt-1 p-2 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">
                    <BookOpen size={18} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--pm-on-surface)' }}>System Architecture Manifesto</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-mono-pm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">VERIFIED</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 font-mono-pm text-[11px] text-[var(--pm-on-surface-variant)]">
                      <span>AUTHOR: <strong className="text-[var(--pm-primary)]">Jane Smith</strong></span>
                      <span>•</span>
                      <span>LAST UPDATED: <strong className="text-[var(--pm-on-surface)]">Oct 12, 2024</strong></span>
                    </div>
                    <p className="text-xs mt-2" style={{ color: 'var(--pm-on-surface-variant)' }}>
                      Core engineering standards and principles governing the Resolve PM technical ecosystem.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0 self-start md:self-center">
                  <button className="px-4 py-2 rounded-lg text-xs font-mono-pm uppercase tracking-widest bg-surface-3 hover:bg-surface-highest text-[var(--pm-on-surface)] border border-border transition-all cursor-pointer">
                    View Doc
                  </button>
                </div>
              </div>

              {/* Document Item 2 */}
              <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl transition-all gap-4 bg-surface-2 border border-border"
                style={{ background: 'var(--pm-surface-high)', borderColor: 'rgba(70,69,84,0.3)' }}>
                <div className="flex items-start gap-4">
                  <div className="mt-1 p-2 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20">
                    <FileText size={18} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Incident Response Protocol</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-mono-pm bg-blue-500/10 text-blue-400 border border-blue-500/20">PROCESS</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 font-mono-pm text-[11px] text-[var(--pm-on-surface-variant)]">
                      <span>AUTHOR: <strong className="text-[var(--pm-primary)]">SecOps Team</strong></span>
                      <span>•</span>
                      <span>LAST UPDATED: <strong className="text-[var(--pm-on-surface)]">Sep 01, 2024</strong></span>
                    </div>
                    <p className="text-xs mt-2" style={{ color: 'var(--pm-on-surface-variant)' }}>
                      Step-by-step procedures for mitigating and recovering from P1 service disruptions.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0 self-start md:self-center">
                  <button className="px-4 py-2 rounded-lg text-xs font-mono-pm uppercase tracking-widest bg-surface-3 hover:bg-surface-highest text-[var(--pm-on-surface)] border border-border transition-all cursor-pointer">
                    View Doc
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Knowledge Graph Insights */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-panel rounded-xl p-6 bg-surface-2 border border-border">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-[var(--pm-primary)]">Knowledge Graph</h2>
              <Network size={16} className="text-blue-400" />
            </div>
            
            <div className="p-4 rounded-lg bg-surface-3 border border-border text-center flex flex-col items-center justify-center min-h-[150px] gap-3">
               <Network size={32} className="text-[var(--pm-on-surface-variant)] opacity-50" />
               <p className="text-xs text-[var(--pm-on-surface-variant)]">Interactive Graph Explorer visualization will load here.</p>
               <span className="font-mono-pm text-[9px] uppercase text-blue-400 tracking-widest border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 rounded">SYSTEM HEALTHY</span>
            </div>

            <div className="mt-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider font-mono-pm text-[var(--pm-on-surface-variant)] mb-2">Most Referenced</h3>
              
              <div className="flex items-center justify-between p-2 rounded hover:bg-surface-3 transition-colors text-xs border border-transparent hover:border-border cursor-pointer">
                <span className="truncate max-w-[200px] text-[var(--pm-primary)]">Design System Guidelines</span>
                <span className="text-[10px] text-[var(--pm-on-surface-variant)] font-mono-pm bg-surface-high px-1.5 rounded">42 links</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded hover:bg-surface-3 transition-colors text-xs border border-transparent hover:border-border cursor-pointer">
                <span className="truncate max-w-[200px] text-[var(--pm-primary)]">Q2 Onboarding Manual</span>
                <span className="text-[10px] text-[var(--pm-on-surface-variant)] font-mono-pm bg-surface-high px-1.5 rounded">28 links</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
