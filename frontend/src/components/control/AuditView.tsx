import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { activityLogService } from '../../services/activityLogService';

const AuditView = React.memo(function AuditView() {
  const { workspace } = useWorkspace();
  const wsId = workspace?.id || '';
  const [chainStatus, setChainStatus] = useState<{ status: string; logCount: number; message: string } | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId) return;
    setLoading(true);
    Promise.all([
      activityLogService.verifyHashChain(wsId),
      activityLogService.getLogs(wsId),
    ]).then(([chain, logEntries]) => {
      setChainStatus({ status: chain.status, logCount: chain.logCount, message: chain.message });
      setLogs(logEntries.slice(0, 50));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [wsId]);

  if (!wsId) {
    return <div className="flex-1 flex items-center justify-center text-text-tertiary font-mono text-sm">No workspace selected</div>;
  }

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12">
      <div className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary">Audit Log</h2>
        <p className="text-[10px] font-mono text-text-tertiary uppercase">Immutable SHA-256 hash chain</p>
      </div>

      <div className="border border-border bg-surface p-4 mb-6">
        <h3 className="text-[10px] font-sans tracking-tight uppercase tracking-wide text-text-secondary mb-3">Chain Health</h3>
        {loading ? (
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white" />
        ) : chainStatus ? (
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${
              chainStatus.status === 'Valid' ? 'bg-green-400' :
              chainStatus.status === 'CHAIN_REINDEX' ? 'bg-blue-400' :
              chainStatus.status === 'Suspicious' ? 'bg-amber-400' : 'bg-red-400'
            }`} />
            <span className="text-sm font-mono">{chainStatus.status === 'CHAIN_REINDEX' ? 'Chain Reindexed' : chainStatus.status}</span>
            <span className="text-[10px] font-mono text-text-quaternary">{chainStatus.logCount} entries — {chainStatus.message}</span>
          </div>
        ) : null}
      </div>

      <div className="border border-border bg-surface">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-border-subtle text-[9px] font-mono uppercase tracking-wider text-text-quaternary">
          <div className="col-span-1">#</div>
          <div className="col-span-2">Action</div>
          <div className="col-span-2">Timestamp</div>
          <div className="col-span-2">Hash (first 16)</div>
          <div className="col-span-2">Prev Hash</div>
          <div className="col-span-3">Metadata</div>
        </div>
        {logs.length === 0 && !loading && (
          <div className="px-4 py-8 text-center text-[11px] font-mono text-text-quaternary">No audit logs found</div>
        )}
        {logs.map((log, i) => (
          <div key={log.id || i} className="grid grid-cols-12 gap-2 px-4 py-1.5 border-b border-border-subtle text-[10px] font-mono text-text-tertiary hover:bg-white/5">
            <div className="col-span-1 text-text-quaternary">{i + 1}</div>
            <div className="col-span-2 truncate">{log.action}</div>
            <div className="col-span-2 truncate">{log.created_at ? new Date(log.created_at).toLocaleString() : '-'}</div>
            <div className="col-span-2 truncate text-text-quaternary">{log.hash?.slice(0, 16) || '-'}</div>
            <div className="col-span-2 truncate text-text-quaternary">{log.previous_hash?.slice(0, 16) || '-'}</div>
            <div className="col-span-3 truncate text-text-quaternary">{JSON.stringify(log.metadata).slice(0, 40)}</div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default AuditView;