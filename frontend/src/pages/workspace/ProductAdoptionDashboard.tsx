import React, { useState } from 'react';
import { Users, MousePointerClick, Zap, LayoutTemplate, Activity } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export function ProductAdoptionDashboard() {
  const { workspace } = useWorkspace() as any;
  const [includeDemoData, setIncludeDemoData] = useState(false);
  const isDemo = workspace?.is_demo_workspace || workspace?.name?.toLowerCase().includes('demo');
  
  // Apply a zero-state if demo is excluded
  const onboarding = isDemo && !includeDemoData ? '0%' : '84%';
  const dropoff = isDemo && !includeDemoData ? '0%' : '12%';
  const templates = isDemo && !includeDemoData ? '0' : '142';
  const dau = isDemo && !includeDemoData ? '0%' : '68%';
  
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8 font-geist">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-3">
            <Users className="w-6 h-6 text-indigo-400" />
            Adoption &amp; Usage Analytics
          </h2>
          <p className="text-sm text-text-tertiary mt-1">Track onboarding completion and feature utilization across the organization.</p>
          {isDemo && !includeDemoData && (
            <p className="text-xs text-signal-warning mt-2 bg-signal-warning/10 inline-block px-2 py-1 rounded">
              Analytics isolated (Demo Workspace). Toggle to include demo data.
            </p>
          )}
        </div>
        {isDemo && (
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
            <input type="checkbox" checked={includeDemoData} onChange={(e) => setIncludeDemoData(e.target.checked)} className="accent-accent-primary" />
            Include Demo Data
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-2 border border-border rounded-xl p-5">
          <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-1">Onboarding Completion</h3>
          <p className="text-3xl font-extrabold text-text-primary mt-2">{onboarding}</p>
          <div className="w-full h-1.5 bg-surface-3 rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-signal-safe transition-all" style={{ width: onboarding }} />
          </div>
        </div>
        <div className="bg-surface-2 border border-border rounded-xl p-5">
          <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-1">Wizard Abandonment</h3>
          <p className="text-3xl font-extrabold text-signal-warning mt-2">{dropoff}</p>
          <p className="text-[10px] text-text-quaternary mt-2">Drop-off at Step 3 (Capacity)</p>
        </div>
        <div className="bg-surface-2 border border-border rounded-xl p-5">
          <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-1">Template Usage</h3>
          <p className="text-3xl font-extrabold text-accent-secondary mt-2">{templates}</p>
          <p className="text-[10px] text-text-quaternary mt-2">Templates deployed this month</p>
        </div>
        <div className="bg-surface-2 border border-border rounded-xl p-5">
          <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-1">DAU / MAU</h3>
          <p className="text-3xl font-extrabold text-indigo-400 mt-2">{dau}</p>
          <p className="text-[10px] text-text-quaternary mt-2">Highly active user base</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary mb-4 flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-text-secondary" /> Feature Utilization
          </h3>
          <div className="space-y-4">
            {[
              { name: 'Executive Dashboard', usage: 92 },
              { name: 'Timeline Impact Engine', usage: 78 },
              { name: 'Capacity Planner', usage: 45 },
              { name: 'Custom Reports', usage: 32 }
            ].map((f, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-text-secondary">{f.name}</span>
                  <span className="font-mono text-text-tertiary">{f.usage}%</span>
                </div>
                <div className="w-full h-1 bg-surface-3 rounded-full overflow-hidden">
                  <div className="h-full bg-accent-primary opacity-80" style={{ width: `${f.usage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-text-secondary" /> Recent Milestones
          </h3>
          <div className="space-y-3">
            <div className="p-3 bg-surface-2 rounded-lg border border-border-subtle flex items-start gap-3">
              <Zap className="w-4 h-4 text-accent-secondary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-text-primary">100th Project Created</p>
                <p className="text-[10px] text-text-tertiary mt-0.5">The organization hit a major adoption milestone today.</p>
              </div>
            </div>
            <div className="p-3 bg-surface-2 rounded-lg border border-border-subtle flex items-start gap-3">
              <MousePointerClick className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-text-primary">New Workflow Discovered</p>
                <p className="text-[10px] text-text-tertiary mt-0.5">Users are frequently combining Capacity Planning with Timeline Replay.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
