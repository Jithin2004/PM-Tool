import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCw, XCircle, CheckCircle2 } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

interface SyncEvent {
  id: string;
  direction: string;
  event_type: string;
  processing_status: string;
  error_message: string | null;
  created_at: string;
  integration_connections: { provider: string };
}

export function SyncHistory() {
  const { workspace } = useWorkspace();
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = async () => {
    if (!workspace) return;
    const { data } = await supabase
      .from('integration_events')
      .select('id, direction, event_type, processing_status, error_message, created_at, integration_connections(provider)')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) setEvents(data as unknown as SyncEvent[]);
    setLoading(false);
  };

  useEffect(() => {
    loadEvents();
  }, [workspace]);

  if (loading) return <div>Loading history...</div>;

  return (
    <div className="bg-bg border border-[var(--pm-border)] rounded-lg overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[var(--pm-border)]/50 border-b border-[var(--pm-border)]">
            <th className="p-3 font-medium text-[var(--text-secondary)] text-sm">Time</th>
            <th className="p-3 font-medium text-[var(--text-secondary)] text-sm">Provider</th>
            <th className="p-3 font-medium text-[var(--text-secondary)] text-sm">Direction</th>
            <th className="p-3 font-medium text-[var(--text-secondary)] text-sm">Event</th>
            <th className="p-3 font-medium text-[var(--text-secondary)] text-sm">Status</th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-8 text-center text-[var(--text-secondary)]">No sync events found.</td>
            </tr>
          ) : events.map(evt => (
            <tr key={evt.id} className="border-b border-[var(--pm-border)] last:border-b-0 hover:bg-[var(--pm-border)]/20 transition-colors">
              <td className="p-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">
                {new Date(evt.created_at).toLocaleString()}
              </td>
              <td className="p-3 text-sm text-white capitalize">{evt.integration_connections?.provider.replace('_', ' ')}</td>
              <td className="p-3 text-sm text-[var(--text-secondary)] capitalize">{evt.direction}</td>
              <td className="p-3 text-sm text-white">{evt.event_type}</td>
              <td className="p-3 text-sm">
                {evt.processing_status === 'success' ? (
                  <span className="flex items-center text-emerald-400"><CheckCircle2 className="w-4 h-4 mr-1" /> Success</span>
                ) : evt.processing_status === 'failed' ? (
                  <div className="flex flex-col">
                    <span className="flex items-center text-red-400"><XCircle className="w-4 h-4 mr-1" /> Failed</span>
                    <span className="text-xs text-red-400/70 mt-1 max-w-[200px] truncate" title={evt.error_message || ''}>{evt.error_message}</span>
                  </div>
                ) : (
                  <span className="flex items-center text-cyan-400"><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Processing</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
