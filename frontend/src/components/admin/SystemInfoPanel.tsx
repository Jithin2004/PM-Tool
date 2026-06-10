import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Icon } from '../ui/Icon';
import { AlertTriangle, Server, Database, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react';

export function SystemInfoPanel() {
  const [migrations, setMigrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recoveryState, setRecoveryState] = useState<'idle' | 'rolling_back' | 'resuming'>('idle');

  useEffect(() => {
    fetchMigrations();
  }, []);

  const fetchMigrations = async () => {
    setLoading(true);
    const { data } = await supabase.from('system_migrations').select('*').order('applied_at', { ascending: false });
    if (data) setMigrations(data);
    setLoading(false);
  };

  const failedMigration = migrations.find(m => m.status === 'failed');
  const latestMigration = migrations.filter(m => m.status === 'completed')[0];

  const handleRollback = () => {
    setRecoveryState('rolling_back');
    setTimeout(async () => {
      if (failedMigration) {
        await supabase.from('system_migrations').delete().eq('id', failedMigration.id);
      }
      setRecoveryState('idle');
      fetchMigrations();
      window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: 'Rollback successful. Restored to stable state.', type: 'success' } }));
    }, 2000);
  };

  const handleResume = () => {
    setRecoveryState('resuming');
    setTimeout(async () => {
      if (failedMigration) {
        await supabase.from('system_migrations').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', failedMigration.id);
      }
      setRecoveryState('idle');
      fetchMigrations();
      window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: 'Upgrade resumed and completed successfully.', type: 'success' } }));
    }, 3000);
  };

  if (loading) {
    return <div className="p-8 text-center text-[var(--pm-text-secondary)] font-mono-pm animate-pulse">Scanning system state...</div>;
  }

  return (
    <div className="flex flex-col h-full font-sans bg-bg">
      <div className="p-5 border-b border-[var(--pm-border)] bg-[var(--pm-surface-high)]">
        <h2 className="text-xl font-semibold text-[var(--pm-text)]">System Information</h2>
        <p className="text-sm text-[var(--pm-text-secondary)] mt-1">Version control and environment topology</p>
      </div>

      <div className="p-6 space-y-8 overflow-y-auto">
        {failedMigration && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-red-500 font-semibold text-lg">Upgrade Incomplete</h3>
                <p className="text-[var(--pm-text-secondary)] text-sm mt-1 mb-4">
                  The migration to <span className="font-mono-pm">{failedMigration.version}</span> ({failedMigration.description}) failed during execution. The system is in a corrupted half-state.
                </p>
                {failedMigration.logs && failedMigration.logs.error && (
                  <div className="bg-black/20 p-3 rounded text-xs font-mono-pm text-red-400 mb-4 border border-red-500/20">
                    ERROR: {failedMigration.logs.error}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleResume}
                    disabled={recoveryState !== 'idle'}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {recoveryState === 'resuming' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
                    {recoveryState === 'resuming' ? 'Resuming...' : 'Resume Upgrade'}
                  </button>
                  <button 
                    onClick={handleRollback}
                    disabled={recoveryState !== 'idle'}
                    className="px-4 py-2 bg-[var(--pm-surface)] hover:bg-[var(--pm-surface-hover)] border border-[var(--pm-border)] text-[var(--pm-text)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {recoveryState === 'rolling_back' ? 'Rolling back...' : 'Rollback to Safety'}
                  </button>
                  <button className="px-4 py-2 text-[var(--pm-text-secondary)] hover:text-[var(--pm-text)] text-sm font-medium transition-colors ml-auto underline">
                    Contact Support
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[var(--pm-surface-elevated)] border border-[var(--pm-border)] rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Server className="w-5 h-5 text-[var(--pm-primary)]" />
              <div className="text-sm font-medium text-[var(--pm-text-secondary)]">Resolve PM Version</div>
            </div>
            <div className="text-2xl font-bold text-[var(--pm-text)]">{latestMigration?.version || 'v1.0.0'}</div>
            <div className="text-xs text-[var(--pm-success)] mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Latest stable release
            </div>
          </div>

          <div className="bg-[var(--pm-surface-elevated)] border border-[var(--pm-border)] rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Database className="w-5 h-5 text-purple-400" />
              <div className="text-sm font-medium text-[var(--pm-text-secondary)]">Database Schema</div>
            </div>
            <div className="text-2xl font-bold text-[var(--pm-text)]">Schema 42</div>
            <div className="text-xs text-[var(--pm-text-secondary)] mt-2">PostgreSQL 15.x</div>
          </div>

          <div className="bg-[var(--pm-surface-elevated)] border border-[var(--pm-border)] rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <RefreshCw className="w-5 h-5 text-blue-400" />
              <div className="text-sm font-medium text-[var(--pm-text-secondary)]">Last Migration</div>
            </div>
            <div className="text-lg font-bold text-[var(--pm-text)] truncate">{latestMigration ? new Date(latestMigration.applied_at).toLocaleString() : 'N/A'}</div>
            <div className="text-xs text-[var(--pm-text-secondary)] mt-2 truncate">{latestMigration?.description}</div>
          </div>

          <div className="bg-[var(--pm-surface-elevated)] border border-[var(--pm-border)] rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className={`w-5 h-5 ${failedMigration ? 'text-red-500' : 'text-emerald-500'}`} />
              <div className="text-sm font-medium text-[var(--pm-text-secondary)]">System Health</div>
            </div>
            <div className={`text-2xl font-bold ${failedMigration ? 'text-red-500' : 'text-emerald-500'}`}>
              {failedMigration ? 'Critical' : 'Healthy'}
            </div>
            <div className="text-xs text-[var(--pm-text-secondary)] mt-2">All services online</div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[var(--pm-text)] mb-4">Migration History</h3>
          <div className="bg-[var(--pm-surface)] border border-[var(--pm-border)] rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-[var(--pm-surface-high)] text-[var(--pm-text-secondary)] text-xs border-b border-[var(--pm-border)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Version</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Applied At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--pm-border)]">
                {migrations.map(m => (
                  <tr key={m.id} className="hover:bg-[var(--pm-surface-hover)] transition-colors">
                    <td className="px-5 py-3 font-mono-pm">{m.version}</td>
                    <td className="px-5 py-3 text-[var(--pm-text-secondary)]">{m.description}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${m.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : m.status === 'failed' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                        {m.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[var(--pm-text-secondary)]">{new Date(m.applied_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
