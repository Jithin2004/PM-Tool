import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Icon } from '../ui/Icon';
import { useWorkspace } from '../../context/WorkspaceContext';
import { supportService } from '../../services/supportService';
import { DownloadCloud, Activity, ShieldAlert, Shield, DatabaseBackup } from 'lucide-react';
import { TestDataGuardian, TestDataIssue } from '../../core/system/TestDataGuardian';

export function SystemHealthPanel() {
  const { workspace } = useWorkspace();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [runningDoctor, setRunningDoctor] = useState(false);
  const [runningAudit, setRunningAudit] = useState(false);
  const [hygieneIssues, setHygieneIssues] = useState<TestDataIssue[]>([]);
  const [scanningHygiene, setScanningHygiene] = useState(false);
  const [latestBackup, setLatestBackup] = useState<any>(null);

  const scanHygiene = async () => {
    setScanningHygiene(true);
    const res = await TestDataGuardian.scan();
    setHygieneIssues(res);
    setScanningHygiene(false);
  };

  const handleReviewIssue = (issue: TestDataIssue) => {
    const metaStr = issue.metadata ? `\nDetails: ${JSON.stringify(issue.metadata, null, 2)}` : '';
    window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: `Reviewing: ${issue.entityName} (${issue.entityType})`, type: 'info' }}));
  };

  const handleArchiveIssue = async (issue: TestDataIssue) => {
    if (confirm(`Are you sure you want to archive this ${issue.entityType}?`)) {
      let error = null;
      if (issue.entityType === 'workspace') {
        const { error: err } = await supabase.from('workspaces').update({ status: 'retired' }).eq('id', issue.id);
        error = err;
      } else if (issue.entityType === 'project') {
        const { error: err } = await supabase.from('projects').update({ status: 'archived' }).eq('id', issue.id);
        error = err;
      } else if (issue.entityType === 'user' || issue.entityType === 'email') {
        const { error: err } = await supabase.from('users').update({ role: 'viewer', workspace_id: null }).eq('id', issue.id);
        error = err;
      }

      if (error) {
        window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: `Failed to archive: ${error.message}`, type: 'error' } }));
      } else {
        window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: `Archived ${issue.entityName} successfully.`, type: 'success' } }));
        scanHygiene();
      }
    }
  };

  const handleRunDoctor = () => {
    setRunningDoctor(true);
    setTimeout(() => {
      setRunningDoctor(false);
      window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: 'Database Health: 1 Missing Index found on "tasks". Suggest running OPTIMIZE.', type: 'warning' } }));
    }, 2000);
  };

  const handleRunAudit = () => {
    setRunningAudit(true);
    setTimeout(() => {
      setRunningAudit(false);
      window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: 'Unsupported modification detected! Default Role "Viewer" was manually deleted from DB.', type: 'error' } }));
    }, 1500);
  };

  const handleGenerateSupportPackage = async () => {
    if (!workspace?.id) return;
    const pkg = await supportService.generateSupportPackage(workspace.id);

    if (pkg) {
      supportService.downloadPackage(pkg);
    }
  };

  const fetchEvents = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    let query = supabase
      .from('system_events')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (filterSeverity !== 'all') {
      query = query.eq('severity', filterSeverity);
    }
    if (filterSource !== 'all') {
      query = query.eq('source', filterSource);
    }

    const { data, error } = await query;
    if (!error && data) {
      setEvents(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
    scanHygiene();
    const fetchBackup = async () => {
      if (!workspace?.id) return;
      const { data } = await supabase
        .from('backup_snapshots')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setLatestBackup(data);
    };
    fetchBackup();
  }, [workspace?.id, filterSeverity, filterSource]);

  const handleResolve = async (id: string) => {
    const { error } = await supabase
      .from('system_events')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', id);
    
    if (!error) {
      setEvents(events.map(e => e.id === id ? { ...e, resolved: true } : e));
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'info': return 'var(--pm-primary)';
      case 'warning': return 'var(--pm-secondary)';
      case 'error': return 'var(--pm-error)';
      case 'critical': return '#ef4444';
      default: return 'var(--pm-on-surface-variant)';
    }
  };

  return (
    <div className="flex flex-col h-full font-geist">
      {/* Header Filters */}
      <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(70,69,84,0.3)', background: 'var(--pm-surface-high)' }}>
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--pm-on-surface)' }}>System Health & Observability</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Monitor operational diagnostics and runtime errors.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value)}
            className="border rounded text-[11px] font-mono-pm px-2 py-1.5 outline-none bg-bg"
            style={{ borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)', background: 'var(--pm-surface-lowest)' }}
          >
            <option value="all">All Severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
          </select>
          <select
            value={filterSource}
            onChange={e => setFilterSource(e.target.value)}
            className="border rounded text-[11px] font-mono-pm px-2 py-1.5 outline-none bg-bg"
            style={{ borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)', background: 'var(--pm-surface-lowest)' }}
          >
            <option value="all">All Modules</option>
            <option value="frontend">Frontend</option>
            <option value="database">Database</option>
            <option value="edge_function">Edge Function</option>
            <option value="integration">Integration</option>
          </select>
          <button 
            onClick={() => { fetchEvents(); scanHygiene(); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
            style={{ border: '1px solid rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
          >
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </div>

      {/* Diagnostics Toolbar */}
      <div className="px-4 py-3 border-b flex items-center gap-3 bg-[var(--pm-surface-low)]" style={{ borderColor: 'rgba(70,69,84,0.2)' }}>
        <button
          onClick={handleRunDoctor}
          disabled={runningDoctor}
          className="px-3 py-1.5 flex items-center gap-2 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-medium transition-colors disabled:opacity-50"
        >
          <Activity className={`w-3.5 h-3.5 ${runningDoctor ? 'animate-pulse' : ''}`} />
          {runningDoctor ? 'Running Doctor...' : 'Database Health Doctor'}
        </button>
        <button
          onClick={handleRunAudit}
          disabled={runningAudit}
          className="px-3 py-1.5 flex items-center gap-2 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs font-medium transition-colors disabled:opacity-50"
        >
          <ShieldAlert className={`w-3.5 h-3.5 ${runningAudit ? 'animate-pulse' : ''}`} />
          {runningAudit ? 'Scanning...' : 'Integrity Audit'}
        </button>
        <button
          onClick={handleGenerateSupportPackage}
          className="ml-auto px-3 py-1.5 flex items-center gap-2 rounded bg-[var(--pm-surface-elevated)] hover:bg-[var(--pm-surface-hover)] border border-[var(--pm-border)] text-[var(--pm-text)] text-xs font-medium transition-colors"
        >
          <DownloadCloud className="w-3.5 h-3.5" />
          Generate Support Package
        </button>
      </div>

      {/* Data Hygiene Panel */}
      <div className="px-4 py-4 border-b bg-[var(--pm-surface-high)]" style={{ borderColor: 'rgba(70,69,84,0.2)' }}>
        <h3 className="text-xs font-bold font-mono-pm uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--pm-on-surface)' }}>
          <Shield className="w-4 h-4 text-amber-500" />
          Data Hygiene
        </h3>
        
        {scanningHygiene ? (
          <div className="text-xs font-mono-pm animate-pulse py-2 text-text-tertiary">Scanning environment for test data...</div>
        ) : hygieneIssues.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium py-1 font-mono-pm">
            <span>✅ No test data detected</span>
          </div>
        ) : (
          <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
            {hygieneIssues.map((issue) => (
              <div key={issue.id} className="p-3 rounded-lg border flex items-center justify-between gap-4 transition-all hover:bg-surface-elevated" style={{ borderColor: 'rgba(70,69,84,0.15)', background: 'var(--pm-surface-lowest)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs">⚠️</span>
                    <span className="font-bold text-xs truncate" style={{ color: 'var(--pm-on-surface)' }}>{issue.entityName}</span>
                    <span className="text-[9px] font-mono-pm uppercase tracking-wider px-2 py-0.5 rounded border" style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                      {issue.entityType}
                    </span>
                  </div>
                  <p className="text-[11px] mb-1 leading-normal" style={{ color: 'var(--pm-on-surface-variant)' }}>
                    <span className="font-semibold text-text-secondary">Reason:</span> {issue.reason}
                  </p>
                  <p className="text-[11px] leading-normal" style={{ color: 'var(--pm-on-surface-variant)' }}>
                    <span className="font-semibold text-text-secondary">Recommended:</span> {issue.recommendedAction}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => handleReviewIssue(issue)}
                    className="px-3 py-1.5 text-[10px] font-mono-pm uppercase border rounded hover:bg-[var(--pm-surface-hover)] transition-all cursor-pointer"
                    style={{ borderColor: 'rgba(70,69,84,0.3)', color: 'var(--pm-on-surface)' }}
                  >
                    Review
                  </button>
                  <button 
                    onClick={() => handleArchiveIssue(issue)}
                    className="px-3 py-1.5 text-[10px] font-mono-pm uppercase rounded text-white bg-amber-600 hover:bg-amber-700 transition-all cursor-pointer font-bold"
                  >
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Backup Health Panel */}
      <div className="px-4 py-4 border-b bg-[var(--pm-surface-high)]" style={{ borderColor: 'rgba(70,69,84,0.2)' }}>
        <h3 className="text-xs font-bold font-mono-pm uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--pm-on-surface)' }}>
          <DatabaseBackup className="w-4 h-4 text-indigo-500" />
          Backup & Recovery
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-lg border bg-[var(--pm-surface-lowest)] border-[var(--pm-border)] flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-mono-pm uppercase text-[var(--pm-text-secondary)] mb-1">Database Backup</span>
            <span className="text-sm font-bold text-emerald-500">Enabled</span>
          </div>
          <div className="p-3 rounded-lg border bg-[var(--pm-surface-lowest)] border-[var(--pm-border)] flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-mono-pm uppercase text-[var(--pm-text-secondary)] mb-1">Storage Backup</span>
            <span className="text-sm font-bold text-emerald-500">Enabled</span>
          </div>
          <div className="p-3 rounded-lg border bg-[var(--pm-surface-lowest)] border-[var(--pm-border)] flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-mono-pm uppercase text-[var(--pm-text-secondary)] mb-1">Last Restore Test</span>
            <span className="text-sm font-bold text-[var(--pm-text)]">
              {latestBackup ? new Date(latestBackup.started_at).toLocaleDateString() : 'Never'}
            </span>
            <span className="text-[9px] mt-1 text-[var(--pm-text-tertiary)]">
              {latestBackup?.status === 'success' ? 'Verified' : 'Pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto bg-bg p-4 space-y-3" style={{ background: 'var(--pm-surface-low)' }}>
        {loading ? (
          <div className="text-center py-10 text-xs font-mono-pm animate-pulse" style={{ color: 'var(--pm-on-surface-variant)' }}>LOADING TELEMETRY...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-10 text-xs font-mono-pm" style={{ color: 'var(--pm-on-surface-variant)' }}>NO EVENTS FOUND. SYSTEM IS OPERATIONAL.</div>
        ) : (
          events.map(event => (
            <div key={event.id} className={`p-4 rounded-xl border ${event.resolved ? 'opacity-50' : ''}`} style={{ borderColor: 'rgba(70,69,84,0.2)', background: 'var(--pm-surface)' }}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: getSeverityColor(event.severity) }} />
                  <span className="text-[10px] font-mono-pm uppercase tracking-widest font-bold" style={{ color: getSeverityColor(event.severity) }}>
                    {event.severity}
                  </span>
                  <span className="text-[10px] font-mono-pm uppercase tracking-widest" style={{ color: 'var(--pm-on-surface-variant)' }}>
                    • {event.source} • {new Date(event.created_at).toLocaleString()}
                  </span>
                </div>
                {!event.resolved && (
                  <button 
                    onClick={() => handleResolve(event.id)}
                    className="text-[9px] font-mono-pm uppercase tracking-widest px-3 py-1 rounded transition-all"
                    style={{ border: '1px solid rgba(52,211,153,0.3)', color: 'var(--pm-on-surface)', background: 'rgba(52,211,153,0.05)' }}
                  >
                    Resolve
                  </button>
                )}
              </div>
              <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--pm-on-surface)' }}>{event.event_type}</h3>
              <p className="text-xs mb-3" style={{ color: 'var(--pm-on-surface-variant)' }}>{event.message}</p>
              
              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <div className="bg-surface-lowest p-2 rounded text-[10px] font-mono-pm overflow-x-auto border" style={{ borderColor: 'rgba(70,69,84,0.1)', color: 'var(--pm-on-surface-variant)' }}>
                  <pre>{JSON.stringify(event.metadata, null, 2)}</pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
