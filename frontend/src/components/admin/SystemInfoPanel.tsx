import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import packageJson from '../../../package.json';
import { Activity, Database, Server, CheckCircle2, AlertTriangle, ShieldCheck, Clock, FileText, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PremiumLoader } from '../common/PremiumLoader';

export function SystemInfoPanel() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'issue'>('checking');
  
  useEffect(() => {
    async function loadStatus() {
      setLoading(true);
      
      // Check DB connection
      try {
        const { error } = await supabase.from('users').select('id').limit(1);
        if (error) setDbStatus('issue');
        else setDbStatus('connected');
      } catch (e) {
        setDbStatus('issue');
      }

      // Load events
      if (profile?.workspace_id) {
        const { data } = await supabase
          .from('system_events')
          .select('*')
          .eq('workspace_id', profile.workspace_id)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (data) setEvents(data);
      }
      
      setLoading(false);
    }
    
    loadStatus();
  }, [profile?.workspace_id]);

  const getSeverityColor = (severity: string) => {
    switch(severity?.toLowerCase()) {
      case 'high': return 'text-red-500 bg-red-500/10';
      case 'medium': return 'text-amber-500 bg-amber-500/10';
      case 'low': return 'text-blue-500 bg-blue-500/10';
      default: return 'text-emerald-500 bg-emerald-500/10';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <PremiumLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full font-geist bg-[var(--pm-bg)] text-[var(--pm-text)]">
      <div className="p-6 border-b border-[var(--pm-border)] bg-[var(--pm-surface)]">
        <h2 className="text-xl font-semibold text-[var(--pm-text)]">System Health</h2>
        <p className="text-sm text-[var(--pm-text-secondary)] mt-1">Monitor workspace services and platform status.</p>
      </div>

      <div className="p-6 space-y-6 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Application Status */}
          <div className="bg-[var(--pm-surface)] border border-[var(--pm-border)] rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                <Activity className="w-4 h-4" />
              </div>
              <div className="text-sm font-medium text-[var(--pm-text-secondary)]">Application Status</div>
            </div>
            <div className="text-2xl font-semibold text-[var(--pm-text)] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              Operational
            </div>
            <div className="text-xs text-[var(--pm-text-secondary)] mt-2">
              Env: <span className="font-mono">{import.meta.env.MODE || 'production'}</span>
            </div>
          </div>

          {/* Database */}
          <div className="bg-[var(--pm-surface)] border border-[var(--pm-border)] rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
                <Database className="w-4 h-4" />
              </div>
              <div className="text-sm font-medium text-[var(--pm-text-secondary)]">Database</div>
            </div>
            <div className={`text-2xl font-semibold ${dbStatus === 'connected' ? 'text-emerald-500' : 'text-red-500'}`}>
              {dbStatus === 'connected' ? 'Connected' : 'Connection issue'}
            </div>
            <div className="text-xs text-[var(--pm-text-secondary)] mt-2">
              Supabase Instance
            </div>
          </div>

          {/* Services */}
          <div className="bg-[var(--pm-surface)] border border-[var(--pm-border)] rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Server className="w-4 h-4" />
              </div>
              <div className="text-sm font-medium text-[var(--pm-text-secondary)]">Services</div>
            </div>
            <div className="space-y-2 mt-1">
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--pm-text-secondary)]">Authentication</span>
                <span className="text-emerald-500 font-medium text-xs bg-emerald-500/10 px-2 py-0.5 rounded">Active</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--pm-text-secondary)]">Storage</span>
                <span className="text-emerald-500 font-medium text-xs bg-emerald-500/10 px-2 py-0.5 rounded">Active</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--pm-text-secondary)]">Realtime</span>
                <span className="text-emerald-500 font-medium text-xs bg-emerald-500/10 px-2 py-0.5 rounded">Active</span>
              </div>
            </div>
          </div>

          {/* Version Info */}
          <div className="bg-[var(--pm-surface)] border border-[var(--pm-border)] rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-sm font-medium text-[var(--pm-text-secondary)]">Version Information</div>
            </div>
            <div className="text-2xl font-semibold text-[var(--pm-text)] tracking-tight">
              v{packageJson.version}
            </div>
            <div className="text-xs text-emerald-500 mt-2 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Latest stable release
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--pm-text)]">Recent System Events</h3>
            <button className="text-xs text-indigo-500 hover:text-indigo-600 font-medium flex items-center gap-1 transition-colors">
              View Audit Logs <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          
          <div className="bg-[var(--pm-surface)] border border-[var(--pm-border)] rounded-xl overflow-hidden shadow-sm">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="w-12 h-12 bg-[var(--pm-surface-hover)] rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-[var(--pm-text-tertiary)]" />
                </div>
                <h3 className="text-[var(--pm-text)] font-medium mb-1">No system events recorded</h3>
                <p className="text-[var(--pm-text-secondary)] text-sm max-w-sm">
                  System events, critical alerts, and infrastructure changes will appear here.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm text-left table-premium">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Category</th>
                    <th>Severity</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--pm-border)]">
                  {events.map((event: any) => (
                    <tr key={event.id} className="hover:bg-[var(--pm-surface-hover)] transition-colors group">
                      <td className="px-6 py-4 font-medium text-[var(--pm-text)]">
                        {event.action || event.description || 'System Event'}
                      </td>
                      <td className="px-6 py-4 text-[var(--pm-text-secondary)]">
                        {event.category || event.source || 'system'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getSeverityColor(event.severity)}`}>
                          {(event.severity || 'info').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[var(--pm-text-secondary)] flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        {new Date(event.created_at).toLocaleString()}
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
