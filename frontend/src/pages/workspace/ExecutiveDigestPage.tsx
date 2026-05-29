import React from 'react';
import { useOperationalData } from '../../context/OperationalDataContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { exportToPDF } from '../../services/pdfExportService';
import { FileText, Download, ShieldAlert, Zap, AlertTriangle, Target, TrendingUp } from 'lucide-react';

export function ExecutiveDigestPage() {
  const { raw: { projects, tasks } } = useOperationalData();
  const { workspace } = useWorkspace() as any;
  const [includeDemoData, setIncludeDemoData] = React.useState(false);

  const isDemo = workspace?.is_demo_workspace || workspace?.name?.toLowerCase().includes('demo');

  // Exclude demo data from analytics if this is a demo workspace and toggle is false
  const activeProjects = projects.filter(p => p.status !== 'archived' && (includeDemoData || !isDemo));
  const completedProjects = projects.filter(p => p.status === 'archived' && (includeDemoData || !isDemo));
  const atRisk = activeProjects.filter(p => p.risk === 'high').length;
  
  const handleExport = () => {
    exportToPDF(workspace?.id || 'unknown', 'ExecutiveDigest', {
      activeProjects: activeProjects.length,
      completedProjects: completedProjects.length,
      atRisk
    });
  };
  
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8 font-geist">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-text-primary flex items-center gap-3">
            <Target className="w-8 h-8 text-accent-secondary" />
            Executive Digest
          </h2>
          <p className="text-sm text-text-tertiary mt-1">High-level strategic summaries for non-technical leadership.</p>
          {isDemo && !includeDemoData && (
            <p className="text-xs text-signal-warning mt-2 bg-signal-warning/10 inline-block px-2 py-1 rounded">
              Analytics isolated (Demo Workspace). Toggle to include demo data.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          {isDemo && (
            <label className="flex items-center gap-2 text-xs text-text-secondary mr-2 cursor-pointer">
              <input type="checkbox" checked={includeDemoData} onChange={(e) => setIncludeDemoData(e.target.checked)} className="accent-accent-primary" />
              Include Demo Data
            </label>
          )}
          <button className="flex items-center gap-2 px-4 py-2 bg-surface-2 border border-border rounded-lg text-xs font-bold text-text-secondary hover:text-text-primary transition-colors">
            <FileText className="w-4 h-4" /> Weekly Digest
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-accent-secondary text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-accent-secondary/90 transition-all shadow-lg shadow-accent-secondary/20">
            <Download className="w-4 h-4" /> Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-2 border border-border rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-signal-safe/5 rounded-full blur-xl group-hover:bg-signal-safe/10 transition-colors" />
          <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">Projects Completed</h3>
          <p className="text-4xl font-extrabold text-text-primary">{completedProjects.length}</p>
          <p className="text-[11px] text-text-quaternary mt-1">this quarter</p>
        </div>
        <div className="bg-surface-2 border border-border rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-signal-critical/5 rounded-full blur-xl group-hover:bg-signal-critical/10 transition-colors" />
          <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">Projects At Risk</h3>
          <p className="text-4xl font-extrabold text-signal-critical">{atRisk}</p>
          <p className="text-[11px] text-text-quaternary mt-1">requiring attention</p>
        </div>
        <div className="bg-surface-2 border border-border rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-signal-warning/5 rounded-full blur-xl group-hover:bg-signal-warning/10 transition-colors" />
          <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">Capacity Risks</h3>
          <p className="text-4xl font-extrabold text-signal-warning">2</p>
          <p className="text-[11px] text-text-quaternary mt-1">overloaded teams</p>
        </div>
        <div className="bg-surface-2 border border-border rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-accent-primary/5 rounded-full blur-xl group-hover:bg-accent-primary/10 transition-colors" />
          <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2">Portfolio Health</h3>
          <p className="text-4xl font-extrabold text-accent-primary">92%</p>
          <p className="text-[11px] text-text-quaternary mt-1">delivery confidence</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6 border-b border-border-subtle pb-3">
            <AlertTriangle className="w-5 h-5 text-signal-warning" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">Top Delay Sources</h3>
          </div>
          <div className="space-y-4">
            {[
              { source: 'Client Verification Wait States', impact: '14 days' },
              { source: 'Infrastructure Provisioning', impact: '8 days' },
              { source: 'QA Environment Blockers', impact: '5 days' }
            ].map((delay, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-surface-2 rounded-lg border border-border-subtle">
                <span className="text-xs font-semibold text-text-secondary">{delay.source}</span>
                <span className="text-xs font-bold text-signal-warning px-2 py-1 bg-signal-warning/10 rounded">{delay.impact} delay</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6 border-b border-border-subtle pb-3">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">Forecast Changes</h3>
          </div>
          <div className="space-y-4">
            {[
              { project: 'Project Phoenix', old: 'Oct 12', new: 'Oct 15', reason: 'Capacity adjustment' },
              { project: 'Mobile App V2', old: 'Nov 1', new: 'Nov 1', reason: 'On track' },
              { project: 'Database Migration', old: 'Dec 5', new: 'Dec 12', reason: 'Infrastructure delay' }
            ].map((fc, i) => (
              <div key={i} className="flex flex-col gap-2 p-3 bg-surface-2 rounded-lg border border-border-subtle">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-secondary">{fc.project}</span>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-text-tertiary line-through">{fc.old}</span>
                    <span className="text-text-primary font-bold">{fc.new}</span>
                  </div>
                </div>
                <span className="text-[10px] text-text-quaternary italic">Reason: {fc.reason}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary mb-4 border-b border-border-subtle pb-2">Executive Summary (Auto-Generated)</h3>
        <p className="text-sm text-text-secondary leading-relaxed">
          The portfolio is maintaining a strong delivery confidence of 92%, with the majority of projects tracking to schedule. 
          The primary bottleneck this week originates from <strong>Client Verification</strong> processes, injecting a cumulative 14 days of drift into the critical path. 
          Capacity remains stable, though Team Alpha is nearing 110% allocation and may require load balancing next sprint to mitigate burnout risks.
        </p>
      </div>
    </div>
  );
}
