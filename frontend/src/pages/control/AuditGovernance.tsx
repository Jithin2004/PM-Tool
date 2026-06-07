import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { Shield, Search, Filter, History } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function AuditGovernance() {
  const { workspace } = useWorkspace();
  const { raw: { profiles } } = useOperationalData();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filters, setFilters] = useState({
    user: '',
    module: '',
    date: ''
  });

  useEffect(() => {
    if (!workspace?.id) return;
    
    const fetchLogs = async () => {
      setLoading(true);
      let query = supabase
        .from('activity_logs')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (filters.user) {
        query = query.eq('actor_id', filters.user);
      }
      if (filters.module) {
        query = query.eq('entity_type', filters.module);
      }
      if (filters.date) {
        // Simple date filtering (exact day)
        const start = new Date(filters.date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(filters.date);
        end.setHours(23, 59, 59, 999);
        query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
      }

      const { data } = await query;
      if (data) setLogs(data);
      setLoading(false);
    };

    fetchLogs();
  }, [workspace?.id, filters]);

  const getUserName = (actorId: string) => {
    if (!actorId) return 'System';
    const profile = profiles?.find((p: any) => p.id === actorId);
    return profile ? profile.full_name || profile.email : 'Unknown User';
  };

  const getModules = () => {
    const modules = new Set(logs.map(l => l.entity_type));
    return Array.from(modules).filter(Boolean);
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8 animate-fade-in font-geist pb-32">
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-accent-primary/20 via-accent-secondary/20 to-transparent blur-2xl opacity-50 -z-10" />
        <h2 className="text-4xl font-semibold tracking-tight text-text-primary mb-2">System Audit Ledger</h2>
        <p className="text-sm text-text-tertiary tracking-wide max-w-2xl">Immutable record of all critical events and actions.</p>
      </div>

      <div className="bg-surface/40 backdrop-blur-md border border-border/50 rounded-2xl p-6 transition-all duration-300 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
          <div className="flex gap-4 w-full md:w-auto overflow-x-auto no-scrollbar pb-1">
            <div className="group/input flex-1 md:w-48">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block">Filter by User</label>
              <select value={filters.user} onChange={e => setFilters(s => ({ ...s, user: e.target.value }))} className="w-full input-premium h-10 px-3 text-xs outline-none">
                <option value="">All Users</option>
                {profiles?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                ))}
              </select>
            </div>
            <div className="group/input flex-1 md:w-40">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block">Filter by Module</label>
              <select value={filters.module} onChange={e => setFilters(s => ({ ...s, module: e.target.value }))} className="w-full input-premium h-10 px-3 text-xs outline-none">
                <option value="">All Modules</option>
                <option value="project">Project</option>
                <option value="task">Task</option>
                <option value="invoice">Finance</option>
                <option value="system">System</option>
              </select>
            </div>
            <div className="group/input flex-1 md:w-40">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block">Filter by Date</label>
              <input type="date" value={filters.date} onChange={e => setFilters(s => ({ ...s, date: e.target.value }))} className="w-full input-premium h-10 px-3 text-xs outline-none" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-text-tertiary text-xs font-mono uppercase tracking-widest animate-pulse">
            Retrieving Audit Records...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center">
            <Shield className="w-8 h-8 text-text-quaternary mb-3" />
            <p className="text-sm font-medium text-text-secondary">No audit records found.</p>
            <p className="text-xs text-text-tertiary mt-1">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/50 bg-surface-3/10 backdrop-blur-md">
            <table className="w-full text-left border-collapse table-premium">
              <thead>
                <tr className="border-b border-border/50 text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                  <th className="px-4 py-3 whitespace-nowrap">Timestamp</th>
                  <th className="px-4 py-3 whitespace-nowrap">Actor (Who)</th>
                  <th className="px-4 py-3 whitespace-nowrap">Action (Did What)</th>
                  <th className="px-4 py-3 whitespace-nowrap">Module</th>
                  <th className="px-4 py-3 min-w-[200px]">Reason / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-surface-2 transition-colors text-xs text-text-secondary">
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-text-tertiary">
                      {new Date(log.created_at).toLocaleString('en-CA', { hour12: false }).replace(',', '')}
                    </td>
                    <td className="px-4 py-3 font-medium text-text-primary flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-accent-primary/10 text-accent-primary flex items-center justify-center font-bold text-[10px]">
                        {getUserName(log.actor_id).charAt(0).toUpperCase()}
                      </div>
                      {getUserName(log.actor_id)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-surface-3 border border-border px-2 py-0.5 rounded font-mono text-[10px] uppercase text-text-secondary">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="uppercase text-[9px] font-bold tracking-widest text-accent-secondary">
                        {log.entity_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-tertiary truncate max-w-xs" title={JSON.stringify(log.metadata)}>
                      {log.metadata?.description || log.metadata?.reason || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
