import React, { useState, useEffect } from 'react';
import { HardDriveDownload, History, FileJson, AlertCircle } from 'lucide-react';
import { exportWorkspace } from '../../services/backupService';
import { useWorkspace } from '../../context/WorkspaceContext';
import { supabase } from '../../lib/supabase';
import { PremiumEmptyState } from '../ui/PremiumEmptyState';

export function BackupRestorePanel() {
  const { workspace } = useWorkspace();
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [workspace?.id]);

  const fetchHistory = async () => {
    if (!workspace?.id) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('workspace_id', workspace.id)
      .eq('action', 'workspace_exported')
      .order('created_at', { ascending: false });
    
    if (data) setHistory(data);
    setLoadingHistory(false);
  };

  const handleExport = async () => {
    if (!workspace) return;
    setExporting(true);
    try {
      const pack = await exportWorkspace(workspace.id);
      if (pack) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(pack, null, 2));
        const dl = document.createElement('a');
        dl.setAttribute("href", dataStr);
        dl.setAttribute("download", `resolve-pm-export-${new Date().getTime()}.json`);
        document.body.appendChild(dl);
        dl.click();
        dl.remove();
        
        // Refresh history
        await fetchHistory();
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full font-geist bg-[var(--pm-bg)]">
      <div className="p-6 border-b border-[var(--pm-border)] bg-[var(--pm-surface)]">
        <h2 className="text-xl font-semibold text-[var(--pm-text)]">Workspace Data Export</h2>
        <p className="text-sm text-[var(--pm-text-secondary)] mt-1 tracking-tight">Generate full JSON snapshots of your workspace data.</p>
      </div>

      <div className="p-6 space-y-8 overflow-y-auto max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[var(--pm-surface)] border border-[var(--pm-border)] rounded-xl p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                <HardDriveDownload className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--pm-text)]">Generate Export</h3>
            </div>
            <div className="flex-1">
              <p className="text-sm text-[var(--pm-text-secondary)]">
                Create a full JSON archive containing all operational data. This raw format is suitable for compliance storage, archiving, or auditing.
              </p>
              <div className="mt-4 p-4 bg-[var(--pm-surface-elevated)] rounded-lg border border-[var(--pm-border)] text-xs text-[var(--pm-text-secondary)] font-mono">
                Included entities:<br />
                <span className="text-[var(--pm-text)]">projects, tasks, users, teams, clients, requirements, milestones, invoices, activity_logs</span>
              </div>
            </div>
            <button 
              onClick={handleExport}
              disabled={exporting}
              className="mt-6 w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <HardDriveDownload className="w-4 h-4" />
                  Generate JSON Export
                </>
              )}
            </button>
          </div>

          <div className="bg-[var(--pm-surface)] border border-[var(--pm-border)] rounded-xl p-6 shadow-sm flex flex-col opacity-75">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[var(--pm-surface-elevated)] border border-[var(--pm-border)] flex items-center justify-center text-[var(--pm-text-tertiary)]">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--pm-text-secondary)]">Restore Workspace</h3>
            </div>
            <div className="flex-1">
              <p className="text-sm text-[var(--pm-text-tertiary)]">
                System restoration from a JSON snapshot requires controlled backend migration and database schema matching.
              </p>
            </div>
            <button 
              disabled
              className="mt-6 w-full py-2.5 bg-[var(--pm-surface-elevated)] border border-[var(--pm-border)] text-[var(--pm-text-tertiary)] rounded-lg text-sm font-medium cursor-not-allowed"
            >
              Restore Workspace (Coming Soon)
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[var(--pm-text)] mb-4 flex items-center gap-2">
            <History className="w-4 h-4" />
            Export History
          </h3>
          <div className="bg-[var(--pm-surface)] border border-[var(--pm-border)] rounded-xl overflow-hidden shadow-sm">
            {loadingHistory ? (
              <div className="p-8 text-center text-[var(--pm-text-tertiary)] text-sm animate-pulse">
                Loading history...
              </div>
            ) : history.length === 0 ? (
              <PremiumEmptyState
                icon={FileJson}
                title="No exports generated yet"
                description="Click Generate JSON Export to create your first workspace data snapshot."
              />
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-[var(--pm-surface-high)] text-[var(--pm-text-secondary)] text-xs border-b border-[var(--pm-border)] uppercase tracking-wider font-mono">
                  <tr>
                    <th className="px-6 py-4 font-medium">Export Date</th>
                    <th className="px-6 py-4 font-medium">Entities Count</th>
                    <th className="px-6 py-4 font-medium">Initiated By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--pm-border)]">
                  {history.map(item => (
                    <tr key={item.id} className="hover:bg-[var(--pm-surface-hover)] transition-colors group">
                      <td className="px-6 py-4 font-medium text-[var(--pm-text)]">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-[var(--pm-text-secondary)] font-mono">
                        {(item.metadata?.projects || 0) + (item.metadata?.tasks || 0) + (item.metadata?.users || 0)} objects
                      </td>
                      <td className="px-6 py-4 text-[var(--pm-text-secondary)]">
                        System Admin
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
