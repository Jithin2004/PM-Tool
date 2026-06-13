import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { Clock, CheckCircle2, TrendingUp, History } from 'lucide-react';
import type { Task, WorkSession } from '../../core/types/execution';

export function PersonalWorkSummary() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!workspace?.id || !profile?.id) {
        setLoading(false);
        return;
      }
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      try {
        const { data: s, error: sErr } = await supabase
          .from('work_sessions')
          .select('*')
          .eq('workspace_id', workspace.id)
          .eq('user_id', profile.id)
          .order('started_at', { ascending: false })
          .limit(50);
        if (sErr) throw sErr;
        
        const { data: t, error: tErr } = await supabase
          .from('tasks')
          .select('*')
          .eq('workspace_id', workspace.id)
          .eq('assignee_id', profile.id);
        if (tErr) throw tErr;

        if (s) setSessions(s as WorkSession[]);
        if (t) setTasks(t as Task[]);
      } catch (err) {
        console.error('Failed to load personal work summary:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [workspace?.id, profile?.id]);

  if (loading) return <div className="p-8 text-center text-xs text-text-tertiary animate-pulse">Loading Work Summary...</div>;

  const totalMins = sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
  const totalHours = Math.round((totalMins / 60) * 10) / 10;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-xl font-bold tracking-tight text-text-primary">My Work Summary</h2>
        <p className="text-sm text-text-secondary mt-1">Review your logged time and task completion.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-surface-2 p-5 rounded-xl border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Total Effort</h3>
            <Clock className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="text-3xl font-bold text-text-primary">{totalHours} <span className="text-sm font-medium text-text-secondary">hours</span></p>
          <p className="text-xs text-text-tertiary mt-2">Logged in current workspace</p>
        </div>

        <div className="bg-surface-2 p-5 rounded-xl border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Tasks Completed</h3>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-text-primary">{completedTasks}</p>
          <p className="text-xs text-text-tertiary mt-2">Historical completion count</p>
        </div>

        <div className="bg-surface-2 p-5 rounded-xl border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Current Focus</h3>
            <TrendingUp className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-text-primary">{tasks.filter(t => t.status === 'in_progress' || t.status === 'assigned').length}</p>
          <p className="text-xs text-text-tertiary mt-2">Active tasks assigned to you</p>
        </div>
      </div>

      {/* Qualitative Productivity Indicators (Sprint 3.3) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10">
          <h4 className="text-sm font-semibold text-emerald-500 mb-1">Strengths & Consistency</h4>
          <p className="text-xs text-text-secondary leading-relaxed">
            Consistently logs focus time on core platform tasks. Delivery patterns show strong independent execution on assigned features.
          </p>
        </div>
        <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/10">
          <h4 className="text-sm font-semibold text-amber-500 mb-1">Support Needed & Learning Areas</h4>
          <p className="text-xs text-text-secondary leading-relaxed">
            Occasional delays due to technical blockers indicate a potential need for earlier architectural alignment before execution.
          </p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-surface-2">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <History className="w-4 h-4 text-text-tertiary" /> Recent Sessions
          </h3>
        </div>
        <div className="divide-y divide-border">
          {sessions.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-tertiary">No sessions logged yet.</div>
          ) : (
            sessions.slice(0, 10).map(s => {
              const t = tasks.find(x => x.id === s.task_id);
              return (
                <div key={s.id} className="p-4 flex items-center justify-between hover:bg-surface-2 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{t?.name || 'Unknown Task'}</p>
                    <p className="text-xs text-text-tertiary mt-1">
                      {new Date(s.started_at).toLocaleDateString()} • {s.entry_type === 'manual' ? 'Manual Entry' : 'Timer'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-text-secondary">{s.duration_minutes} mins</p>
                    <p className="text-[10px] font-mono uppercase text-text-tertiary mt-1">{s.session_type}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
