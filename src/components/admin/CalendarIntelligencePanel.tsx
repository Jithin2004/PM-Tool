import React, { useState, useEffect, useMemo } from 'react';
import { CalendarDays, RefreshCw, Check, X, AlertTriangle, History, Globe } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { holidaySourceService } from '../../services/holidaySourceService';
import { supabase } from '../../lib/supabase';
import { COUNTRIES } from '../../data/countries';
import type { SyncLogEntry } from '../../services/holidaySourceService';

export function CalendarIntelligencePanel() {
  const { workspace } = useWorkspace();
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [importedHolidays, setImportedHolidays] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const countryData = useMemo(() => {
    if (!workspace?.settings?.country) return null;
    return COUNTRIES.find(c => c.name === workspace.settings.country);
  }, [workspace?.settings?.country]);

  const loadData = async () => {
    if (!workspace?.id) return;
    const [logs, holidays] = await Promise.all([
      holidaySourceService.getSyncLogs(workspace.id),
      holidaySourceService.getImportedHolidays(workspace.id)
    ]);
    setSyncLogs(logs);
    setImportedHolidays(holidays);
  };

  useEffect(() => {
    loadData();
  }, [workspace?.id]);

  const handleSyncNow = async () => {
    if (!workspace?.id || !workspace.settings.country || syncing) return;
    setSyncing(true);
    setLastSyncResult(null);
    try {
      const result = await holidaySourceService.syncForWorkspace(
        workspace.id,
        workspace.settings.country,
        workspace.settings.region || '',
        workspace.ownerId
      );
      setLastSyncResult(`Sync complete: ${result.imported} holidays imported (${result.status})`);
      await loadData();
    } catch (err: any) {
      setLastSyncResult(`Sync failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteHoliday = async (eventId: string) => {
    if (!workspace?.id || deletingIds.has(eventId)) return;
    setDeletingIds(prev => new Set(prev).add(eventId));
    try {
      await supabase.from('calendar_events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventId)
        .is('deleted_at', null);
      setImportedHolidays(prev => prev.filter(h => (h as any).id !== eventId));
    } catch (err) {
      console.warn('Failed to delete holiday:', err);
    } finally {
      setDeletingIds(prev => { const next = new Set(prev); next.delete(eventId); return next; });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-6">
          <h2 className="text-3xl font-medium tracking-tight mb-2">Calendar Intelligence</h2>
          <p className="text-sm text-white/85 font-mono tracking-tighter">
            Manage imported holidays, sync logs, and regional calendar data for {workspace?.settings?.country || 'your workspace'}.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-white/10 bg-[#0c0c0c] p-6">
            <h3 className="text-sm font-mono uppercase tracking-widest mb-4">Region & Source</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-white/60">Country</span>
                <span className="font-medium">{workspace?.settings?.country || 'Not set'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">State/Region</span>
                <span className="font-medium">{workspace?.settings?.region || 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">City</span>
                <span className="font-medium">{workspace?.settings?.city || 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Timezone</span>
                <span className="font-medium">{workspace?.settings?.timezone || 'UTC'}</span>
              </div>
              {countryData && (
                <div className="flex justify-between">
                  <span className="text-white/60">Supported states</span>
                  <span className="font-medium">{countryData.states.length > 0 ? `${countryData.states.length} states/regions` : 'None defined'}</span>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-white/10">
              <button
                onClick={handleSyncNow}
                disabled={syncing || !workspace?.settings?.country}
                className="w-full bg-white text-black h-10 font-semibold hover:bg-neutral-200 transition-colors uppercase text-xs tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Holidays Now'}
              </button>
              {lastSyncResult && (
                <div className={`mt-3 text-xs font-mono px-3 py-2 ${lastSyncResult.includes('failed') ? 'bg-red-500/10 text-red-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
                  {lastSyncResult}
                </div>
              )}
            </div>
          </div>

          <div className="border border-white/10 bg-[#0c0c0c] p-6">
            <h3 className="text-sm font-mono uppercase tracking-widest mb-4">Active Imported Holidays ({importedHolidays.length})</h3>
            <div className="divide-y divide-white/5 max-h-[320px] overflow-y-auto">
              {importedHolidays.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <CalendarDays className="w-8 h-8 text-white/75 mb-3" />
                  <p className="text-xs font-mono text-white/85 text-center uppercase">No imported holidays.</p>
                  <p className="text-[10px] text-white/50 mt-1">Sync a country with holiday support.</p>
                </div>
              )}
              {(importedHolidays as any[]).map((h: any) => (
                <div key={h.id || h.date} className="flex items-center justify-between py-3 px-1 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Globe className="w-4 h-4 text-white/40 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{h.name || h.title}</p>
                      <p className="text-[10px] text-white/50 font-mono">{h.date} {h.source ? `· ${h.source}` : ''}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteHoliday(h.id)}
                    disabled={deletingIds.has(h.id)}
                    className="text-[9px] font-mono text-red-500 hover:text-red-400 uppercase tracking-widest px-2 py-1 border border-red-500/20 hover:border-red-500/40 transition-colors disabled:opacity-40 shrink-0"
                  >
                    {deletingIds.has(h.id) ? '...' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 border border-white/10 bg-[#0c0c0c] p-6">
          <h3 className="text-sm font-mono uppercase tracking-widest mb-4 flex items-center gap-2">
            <History className="w-4 h-4" />
            Sync History ({syncLogs.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="px-4 py-3 text-[9px] font-mono uppercase tracking-widest text-white/60">Date</th>
                  <th className="px-4 py-3 text-[9px] font-mono uppercase tracking-widest text-white/60">Provider</th>
                  <th className="px-4 py-3 text-[9px] font-mono uppercase tracking-widest text-white/60">Country</th>
                  <th className="px-4 py-3 text-[9px] font-mono uppercase tracking-widest text-white/60">Year</th>
                  <th className="px-4 py-3 text-[9px] font-mono uppercase tracking-widest text-white/60">Found</th>
                  <th className="px-4 py-3 text-[9px] font-mono uppercase tracking-widest text-white/60">Imported</th>
                  <th className="px-4 py-3 text-[9px] font-mono uppercase tracking-widest text-white/60">Status</th>
                  <th className="px-4 py-3 text-[9px] font-mono uppercase tracking-widest text-white/60">Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {syncLogs.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-xs font-mono text-white/40 italic">No sync logs yet.</td></tr>
                )}
                {syncLogs.map(log => (
                  <tr key={log.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-[10px] font-mono text-white/70">{log.created_at ? new Date(log.created_at).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 text-[10px] font-mono text-white/80">{log.provider}</td>
                    <td className="px-4 py-3 text-[10px] font-mono text-white/80">{log.country}{log.region ? `/ ${log.region}` : ''}</td>
                    <td className="px-4 py-3 text-[10px] font-mono text-white/60">{log.year}</td>
                    <td className="px-4 py-3 text-[10px] font-mono text-white/80">{log.holidays_found}</td>
                    <td className="px-4 py-3 text-[10px] font-mono text-white/80">{log.holidays_imported}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-mono uppercase px-2 py-0.5 border ${
                        log.status === 'success' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' :
                        log.status === 'partial' ? 'border-amber-500/30 text-amber-400 bg-amber-500/5' :
                        log.status === 'failed' ? 'border-red-500/30 text-red-400 bg-red-500/5' :
                        'border-white/10 text-white/50 bg-white/5'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[9px] font-mono text-white/35 max-w-[80px] truncate" title={log.hash}>{log.hash?.substring(0, 12) || '-'}</td>
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
