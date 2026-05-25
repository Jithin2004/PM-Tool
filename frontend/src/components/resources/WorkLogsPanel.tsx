import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { Clock, Calendar, Users, Search, CheckCircle, XCircle } from 'lucide-react';
import { getLocalDateString } from '../../utils/timeUtils';

export function WorkLogsPanel() {
  const { profile } = useAuth();
  const { profiles, tasks, projects } = useDashboard();
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());
  const [search, setSearch] = useState('');

  const logs = useMemo(() => {
    const completed = tasks.filter((t: any) => t.status === 'done' && t.updated_at);
    const byProfile = profiles.map((p: any) => {
      const assigned = tasks.filter((t: any) => t.assignee_id === p.id);
      const completedToday = assigned.filter((t: any) => t.status === 'done' && t.updated_at?.startsWith(selectedDate));
      const inProgress = assigned.filter((t: any) => t.status === 'in_progress');
      const totalHrs = assigned.reduce((s: number, t: any) => s + (t.estimated_hours || 0), 0);
      return { profile: p, completedToday: completedToday.length, inProgress: inProgress.length, totalTasks: assigned.length, totalHours: totalHrs };
    });
    return byProfile;
  }, [tasks, profiles, selectedDate]);

  const filtered = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter((l: any) => l.profile.full_name?.toLowerCase().includes(q) || l.profile.email?.toLowerCase().includes(q));
  }, [logs, search]);

  const dayStats = useMemo(() => {
    const totalCompleted = logs.reduce((s: number, l: any) => s + l.completedToday, 0);
    const totalInProgress = logs.reduce((s: number, l: any) => s + l.inProgress, 0);
    const totalHours = logs.reduce((s: number, l: any) => s + l.totalHours, 0);
    return { totalCompleted, totalInProgress, totalHours };
  }, [logs]);

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12 space-y-8">
      <div>
        <h2 className="text-3xl font-medium tracking-tight mb-1">Work Logs</h2>
        <p className="text-sm text-text-secondary font-mono tracking-tighter">Time tracking, attendance, and productivity analytics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center bg-surface border border-border p-6">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-bg border border-border h-11 pl-10 pr-4 text-sm font-mono text-text-primary focus:border-white/30 outline-none" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">Search Profile</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input type="text" placeholder="Name or email..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-bg border border-border h-11 pl-10 pr-4 text-sm font-mono text-text-primary focus:border-white/30 outline-none placeholder:text-text-quaternary" />
          </div>
        </div>
        <div className="text-center border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-6">
          <p className="text-[9px] font-mono text-text-tertiary uppercase tracking-wide mb-1">Completed Today</p>
          <p className="text-2xl font-bold text-signal-safe font-sans tracking-tight">{dayStats.totalCompleted}</p>
        </div>
        <div className="text-center border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-6">
          <p className="text-[9px] font-mono text-text-tertiary uppercase tracking-wide mb-1">In Progress</p>
          <p className="text-2xl font-bold text-signal-warning font-sans tracking-tight">{dayStats.totalInProgress}</p>
        </div>
      </div>

      <div className="border border-border bg-surface overflow-hidden">
        <div className="p-6 border-b border-border bg-bg flex justify-between items-center">
          <h3 className="text-xs font-sans tracking-tight uppercase tracking-wide">Daily Productivity Log</h3>
          <span className="text-[9px] font-mono text-text-tertiary">{selectedDate}</span>
        </div>
        <div className="divide-y divide-white/5">
          {filtered.map((entry: any) => (
            <div key={entry.profile.id} className="p-6 flex items-center justify-between hover:bg-surface-3">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 border border-border bg-white/5 flex items-center justify-center overflow-hidden">
                  {entry.profile.avatar_url ? (
                    <img src={entry.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-5 h-5 text-text-quaternary" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-text-secondary">{entry.profile.full_name || 'Anonymous'}</p>
                  <p className="text-[10px] font-mono text-text-tertiary uppercase">{entry.profile.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-signal-safe">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-mono">{entry.completedToday} done</span>
                </div>
                <div className="flex items-center gap-2 text-signal-warning">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-mono">{entry.inProgress} active</span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-mono text-text-tertiary">{entry.totalHours}h total</p>
                  <p className="text-[9px] font-mono text-text-quaternary">{entry.totalTasks} tasks assigned</p>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="p-12 text-center text-xs font-mono text-text-tertiary italic">No work logs for this date.</div>
          )}
        </div>
      </div>
    </div>
  );
}
