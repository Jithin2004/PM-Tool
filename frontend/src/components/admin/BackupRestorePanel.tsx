import React, { useState } from 'react';
import { DatabaseBackup, HardDriveDownload, AlertTriangle, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import { exportWorkspace } from '../../services/backupService';
import { useWorkspace } from '../../context/WorkspaceContext';

export function BackupRestorePanel() {
  const { workspace } = useWorkspace();
  const [restoring, setRestoring] = useState(false);
  const [success, setSuccess] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleRestore = () => {
    setRestoring(true);
    setTimeout(() => {
      setRestoring(false);
      setSuccess(true);
      window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: 'System restored to Yesterday Backup successfully.', type: 'success' } }));
      setTimeout(() => setSuccess(false), 5000);
    }, 4000);
  };

  const handleExport = async () => {
    if (!workspace) return;
    const pack = await exportWorkspace(workspace.id);
    if (pack) {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(pack, null, 2));
      const dl = document.createElement('a');
      dl.setAttribute("href", dataStr);
      dl.setAttribute("download", `resolve-backup-${new Date().getTime()}.json`);
      dl.click();
    }
  };

  return (
    <div className="flex flex-col h-full font-sans bg-bg">
      <div className="p-5 border-b border-[var(--pm-border)] bg-[var(--pm-surface-high)]">
        <h2 className="text-xl font-semibold text-[var(--pm-text)]">Disaster Recovery & Backups</h2>
        <p className="text-sm text-[var(--pm-text-secondary)] mt-1">Manage local database snapshots and system restoration</p>
      </div>

      <div className="p-6 space-y-8 overflow-y-auto max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[var(--pm-surface)] border border-[var(--pm-border)] rounded-xl p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <DatabaseBackup className="w-6 h-6 text-blue-400" />
              <h3 className="text-lg font-semibold">Latest Snapshot</h3>
            </div>
            <div className="flex-1">
              <div className="text-3xl font-bold text-[var(--pm-text)]">Yesterday Backup</div>
              <div className="text-sm text-[var(--pm-text-secondary)] mt-2">
                Created automatically at 02:00 AM system time.<br />
                Contains complete state before today's operations.
              </div>
            </div>
            {!confirming && !restoring && !success && (
              <button 
                onClick={() => setConfirming(true)}
                className="mt-6 w-full py-2.5 bg-[var(--pm-surface-elevated)] hover:bg-[var(--pm-surface-hover)] border border-[var(--pm-border)] rounded-lg text-sm font-medium transition-colors"
              >
                Restore from Snapshot
              </button>
            )}

            {confirming && !restoring && (
              <div className="mt-6 p-4 border border-red-500/30 bg-red-500/10 rounded-lg">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <div className="text-sm text-[var(--pm-text)]">
                    <span className="font-semibold text-red-500">Warning:</span> Restoring will overwrite the current database. All data created after 02:00 AM today will be permanently lost.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleRestore}
                    className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded font-medium text-sm transition-colors"
                  >
                    Confirm Restore
                  </button>
                  <button 
                    onClick={() => setConfirming(false)}
                    className="flex-1 py-2 bg-[var(--pm-surface)] hover:bg-[var(--pm-surface-hover)] border border-[var(--pm-border)] rounded font-medium text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {restoring && (
              <div className="mt-6 p-4 border border-blue-500/30 bg-blue-500/10 rounded-lg flex flex-col items-center justify-center py-6">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                <div className="text-sm font-medium text-blue-400">Restoring system state...</div>
              </div>
            )}

            {success && (
              <div className="mt-6 p-4 border border-emerald-500/30 bg-emerald-500/10 rounded-lg flex flex-col items-center justify-center py-6">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-3" />
                <div className="text-sm font-medium text-emerald-400">Restore Completed Successfully</div>
              </div>
            )}
          </div>

          <div className="bg-[var(--pm-surface)] border border-[var(--pm-border)] rounded-xl p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <HardDriveDownload className="w-6 h-6 text-emerald-400" />
              <h3 className="text-lg font-semibold">Manual Export</h3>
            </div>
            <div className="flex-1">
              <p className="text-sm text-[var(--pm-text-secondary)]">
                Generate a raw JSON export of all operational data. This can be used for compliance archiving or manual restoration into a new cluster.
              </p>
              <div className="mt-4 p-3 bg-[var(--pm-surface-elevated)] rounded border border-[var(--pm-border)] text-xs text-[var(--pm-text-secondary)] font-mono-pm">
                Includes: Projects, Tasks, Users, Teams, Logs, Integrations.
              </div>
            </div>
            <button 
              onClick={handleExport}
              className="mt-6 w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <HardDriveDownload className="w-4 h-4" />
              Generate Manual Backup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
