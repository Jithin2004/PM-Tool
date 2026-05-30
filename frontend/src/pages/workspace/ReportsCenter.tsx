import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ResolveLayout } from '../../app/layouts/ResolveLayout';
import { FileText, Download, Mail, PieChart, Activity, Clock } from 'lucide-react';
import { exportToPDF } from '../../services/pdfExportService';

export default function ReportsCenter() {
  const { workspace } = useWorkspace();
  const [exporting, setExporting] = useState(false);

  const handleExport = async (type: string, reportName?: any) => {
    if (type !== 'PDF') return;
    setExporting(true);
    await exportToPDF(workspace?.id || 'unknown', reportName || 'PortfolioReport', { timestamp: Date.now() });
    setExporting(false);
  };

  return (
    <div className="space-y-8 pb-16 font-geist text-slate-100 max-w-7xl mx-auto mt-4 px-4">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-border/50 pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--pm-on-surface)]">Reports & Exports</h1>
          <p className="text-sm mt-1 text-[var(--pm-on-surface-variant)]">
            Generate capacity reports and delay analytics.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Exports */}
        <div className="bg-surface-3 border border-border/50 p-6 rounded-xl space-y-4">
          <div className="flex items-center gap-3">
             <Download className="w-6 h-6 text-emerald-400" />
             <h2 className="text-lg font-semibold text-[var(--pm-on-surface)]">Data Exports</h2>
          </div>
          <p className="text-xs text-[var(--pm-on-surface-variant)] leading-relaxed">
            Export raw portfolio data and wait-state analytics for offline viewing or integration.
          </p>
          <div className="flex gap-3">
            <button onClick={() => handleExport('PDF')} disabled={exporting} className="px-4 py-2 bg-surface-4 border border-border/50 text-[var(--pm-on-surface)] rounded-lg text-xs font-semibold hover:bg-surface-highest transition-colors cursor-pointer disabled:opacity-50">
              {exporting ? 'Exporting...' : 'Export PDF'}
            </button>
            <button disabled className="px-4 py-2 bg-surface-4 border border-border/50 text-[var(--pm-on-surface-variant)] opacity-50 rounded-lg text-xs font-semibold cursor-not-allowed">
              Export Excel (Coming Soon)
            </button>
            <button disabled className="px-4 py-2 bg-surface-4 border border-border/50 text-[var(--pm-on-surface-variant)] opacity-50 rounded-lg text-xs font-semibold cursor-not-allowed">
              Export CSV (Coming Soon)
            </button>
          </div>
        </div>
      </div>

      {/* Report Templates */}
      <h2 className="text-xl font-semibold mt-10 mb-4 text-[var(--pm-on-surface)]">Report Templates</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[
          { name: 'Delivery Health', icon: <Activity className="w-5 h-5 text-emerald-400" /> },
          { name: 'Capacity Forecast', icon: <PieChart className="w-5 h-5 text-indigo-400" /> },
          { name: 'Delays & Wait-States', icon: <Clock className="w-5 h-5 text-amber-400" /> },
          { name: 'Forecast Accuracy', icon: <Activity className="w-5 h-5 text-blue-400" /> },
          { name: 'Project Completion', icon: <FileText className="w-5 h-5 text-purple-400" /> },

        ].map(r => (
          <div key={r.name} onClick={() => handleExport('PDF', r.name.replace(/\s+/g, ''))} className="bg-surface-3 border border-border/50 p-5 rounded-xl flex items-center justify-between cursor-pointer hover:border-[var(--pm-primary)] transition-colors group">
            <div className="flex items-center gap-3">
              {r.icon}
              <span className="text-sm font-semibold text-[var(--pm-on-surface)]">{r.name}</span>
            </div>
            <Download className="w-4 h-4 text-[var(--pm-on-surface-variant)] opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>
    </div>
  );
}
