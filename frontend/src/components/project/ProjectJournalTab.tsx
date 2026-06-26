import React, { useEffect, useState } from 'react';
import { journalService, JournalEvent } from '../../services/journalService';
import { Calendar, CheckCircle, AlertTriangle, FileText, Activity, ShieldAlert, Zap } from 'lucide-react';

interface ProjectJournalTabProps {
  projectId: string;
}

export function ProjectJournalTab({ projectId }: ProjectJournalTabProps) {
  const [events, setEvents] = useState<JournalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadJournal() {
      setLoading(true);
      const data = await journalService.getProjectJournal(projectId);
      setEvents(data);
      setLoading(false);
    }
    loadJournal();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-tertiary">
        <div className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full mr-3" />
        Loading Project Journal...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-text-tertiary space-y-3">
        <Activity className="w-8 h-8 opacity-50" />
        <p>No journal events recorded yet.</p>
        <p className="text-xs max-w-sm text-center">
          Meetings, Approvals, and Decisions will automatically appear here as the permanent operational memory of this project.
        </p>
      </div>
    );
  }

  // Group by date
  const grouped: Record<string, JournalEvent[]> = {};
  events.forEach(ev => {
    const d = new Date(ev.occurredAt);
    const dateStr = d.toLocaleDateString('en-GB'); // dd/mm/yyyy roughly
    if (!grouped[dateStr]) grouped[dateStr] = [];
    grouped[dateStr].push(ev);
  });

  const dates = Object.keys(grouped).sort((a, b) => {
    const partsA = a.split('/');
    const partsB = b.split('/');
    if (partsA.length === 3 && partsB.length === 3) {
      const da = new Date(Number(partsA[2]), Number(partsA[1]) - 1, Number(partsA[0])).getTime();
      const db = new Date(Number(partsB[2]), Number(partsB[1]) - 1, Number(partsB[0])).getTime();
      return db - da; // Descending
    }
    return 0;
  });

  const getIcon = (type: string, severity: string) => {
    if (type === 'Meeting') return <Calendar className="w-4 h-4" />;
    if (type === 'Approval') {
      if (severity === 'success') return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      if (severity === 'critical') return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      if (severity === 'warning') return <ShieldAlert className="w-4 h-4 text-amber-400" />;
      return <CheckCircle className="w-4 h-4" />;
    }
    if (type === 'Risk') return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    if (type === 'Finance') return <Activity className="w-4 h-4 text-emerald-400" />;
    return <Zap className="w-4 h-4 text-indigo-400" />;
  };

  return (
    <div className="space-y-8 pr-2 h-[500px] overflow-y-auto">
      {dates.map(date => (
        <div key={date} className="relative">
          <div className="sticky top-0 bg-surface-1 z-10 py-2 border-b border-border/40 mb-4">
            <h4 className="text-xs font-bold tracking-widest text-text-secondary uppercase">{date}</h4>
          </div>
          
          <div className="space-y-4 pl-4 border-l-2 border-border/50 ml-2">
            {grouped[date].map(ev => (
              <div key={ev.id} className="relative bg-surface-2 p-4 rounded-xl border border-border/50 hover:border-border transition-colors">
                <div className="absolute -left-[26px] top-4 w-6 h-6 rounded-full bg-surface-1 border-2 border-border flex items-center justify-center z-10">
                  <div className="w-2 h-2 rounded-full bg-[var(--pm-primary)]" />
                </div>
                
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {getIcon(ev.providerType, ev.severity || 'info')}
                      <span className="text-[10px] font-mono tracking-wider text-text-tertiary uppercase">{ev.providerType}</span>
                      <span className="text-[10px] text-text-tertiary px-2 py-0.5 rounded-full bg-surface-3">{new Date(ev.occurredAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <h5 className="font-bold text-text-primary">{ev.title}</h5>
                  </div>
                  {ev.status && (
                    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-md ${ev.severity === 'success' ? 'bg-emerald-500/10 text-emerald-400' : ev.severity === 'critical' ? 'bg-rose-500/10 text-rose-400' : ev.severity === 'warning' ? 'bg-amber-500/10 text-amber-400' : 'bg-surface-3 text-text-secondary'}`}>
                      {ev.status}
                    </span>
                  )}
                </div>

                {ev.summary && (
                  <div className="text-sm text-text-secondary mt-2 bg-surface-3/50 p-3 rounded-lg border border-border/30">
                    {ev.summary}
                  </div>
                )}

                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/40">
                  <div className="text-[10px] font-mono text-text-tertiary uppercase flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-surface-3 flex items-center justify-center border border-border/50">
                      {ev.actor?.charAt(0).toUpperCase() || '?'}
                    </span>
                    {ev.actor || 'System'}
                  </div>
                  
                  {ev.providerType === 'Approval' && ev.payload?.conditions && ev.payload.conditions.length > 0 && (
                    <div className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      {ev.payload.conditions.length} Conditions
                    </div>
                  )}
                  {ev.providerType === 'Meeting' && ev.payload?.action_items && ev.payload.action_items.length > 0 && (
                    <div className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {ev.payload.action_items.length} Action Items
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
