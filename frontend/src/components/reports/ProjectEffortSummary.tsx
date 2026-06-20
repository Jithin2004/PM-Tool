import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import type { Task, WorkSession } from '../../core/types/execution';
import { predictionEngine } from '../../core/engines/predictionEngine';
import { AlertCircle, BarChart2, Clock, Activity } from 'lucide-react';

export function ProjectEffortSummary({ projectId }: { projectId: string }) {
  const { workspace } = useWorkspace();
  const { raw } = useOperationalData();
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!workspace?.id || !projectId) {
        setLoading(false);
        return;
      }
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      try {
        const { data: t, error: tErr } = await supabase
          .from('tasks')
          .select('*')
          .eq('project_id', projectId);
        if (tErr) throw tErr;
        
        const taskIds = t ? t.map(x => x.id) : [];

        if (taskIds.length > 0) {
          const { data: s, error: sErr } = await supabase
            .from('work_sessions')
            .select('*')
            .in('task_id', taskIds);
          if (sErr) throw sErr;
          if (s) setSessions(s as WorkSession[]);
        } else {
          setSessions([]);
        }
        
        if (t) setTasks(t as Task[]);

        const { data: lv, error: lvErr } = await supabase.from('personal_leave').select('*');
        if (lvErr) throw lvErr;
        if (lv) setLeaves(lv);

        const { data: hol, error: holErr } = await supabase.from('workspace_holidays').select('*');
        if (holErr) throw holErr;
        if (hol) setHolidays(hol);

      } catch (err) {
        console.error('Failed to load project effort data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [workspace?.id, projectId]);

  const totalMins = sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
  const totalHours = Math.round((totalMins / 60) * 10) / 10;
  const estimatedHours = tasks.reduce((acc, t) => acc + (t.estimated_hours || 0), 0);

  const [totalMinDays, setTotalMinDays] = useState(0);
  const [totalMaxDays, setTotalMaxDays] = useState(0);
  const [allRisks, setAllRisks] = useState<string[]>([]);
  const [allExplanations, setAllExplanations] = useState<string[]>([]);
  const [predictionsLoading, setPredictionsLoading] = useState(false);

  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'done');
  const mappedLeaves = leaves.map(l => ({ ...l, event_type: 'leave' }));
  const mappedHolidays = holidays.map(h => ({ ...h, event_type: 'holiday' }));

  useEffect(() => {
    async function loadPredictions() {
      if (!workspace?.id || activeTasks.length === 0) return;
      setPredictionsLoading(true);
      let sumMin = 0;
      let sumMax = 0;
      const risks = new Set<string>();
      const expls = new Set<string>();

      const promises = activeTasks.map(t => predictionEngine.predictCompletionRange(workspace.id, t, mappedLeaves, mappedHolidays));
      const results = await Promise.all(promises);

      results.forEach(pred => {
        sumMin += pred.minDays;
        sumMax += pred.maxDays;
        pred.riskFactors.forEach(r => risks.add(r));
        if (pred.explanation.includes('Because: ')) {
          const parts = pred.explanation.split('Because: ')[1].split(', ');
          parts.forEach(p => expls.add(p));
        }
      });

      setTotalMinDays(sumMin);
      setTotalMaxDays(sumMax);
      setAllRisks(Array.from(risks));
      setAllExplanations(Array.from(expls));
      setPredictionsLoading(false);
    }
    loadPredictions();
  }, [tasks, workspace?.id]);

  if (loading) return <div className="p-8 text-center text-xs text-text-tertiary animate-pulse">Loading Effort Data...</div>;

  return (
    <div className="p-4 bg-surface-2 rounded-xl border border-border mt-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart2 className="w-5 h-5 text-indigo-400" />
        <h3 className="text-lg font-semibold text-text-primary tracking-tight">Project Effort Summary</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface p-4 rounded-lg border border-border flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-text-tertiary mb-1">Total Effort Logged</p>
            <p className="text-2xl font-bold text-text-primary">{totalHours} <span className="text-xs text-text-secondary font-medium">hrs</span></p>
          </div>
          <Clock className="w-8 h-8 text-indigo-400/20" />
        </div>

        <div className="bg-surface p-4 rounded-lg border border-border flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-text-tertiary mb-1">Total Estimated</p>
            <p className="text-2xl font-bold text-text-primary">{estimatedHours} <span className="text-xs text-text-secondary font-medium">hrs</span></p>
          </div>
          <Activity className="w-8 h-8 text-emerald-400/20" />
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-border">
        <h4 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-purple-400" />
          Delivery Insights
        </h4>

        {activeTasks.length === 0 ? (
          <p className="text-xs text-text-tertiary">No active tasks to predict.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface p-4 rounded-lg border border-border">
              <p className="text-xs font-medium text-text-tertiary mb-1">Estimated Completion Range (Active Work)</p>
              <p className="text-xl font-bold text-text-primary">{totalMinDays.toFixed(1)} - {totalMaxDays.toFixed(1)} <span className="text-xs font-medium text-text-secondary">days</span></p>
            </div>

            <div className="bg-surface p-4 rounded-lg border border-border">
              <p className="text-xs font-medium text-text-tertiary mb-2">Why?</p>
              <ul className="space-y-1">
                {allExplanations.slice(0, 4).map((expl, i) => (
                  <li key={i} className="text-[11px] text-text-secondary flex items-start gap-1.5">
                    <span className="text-purple-400 mt-0.5">•</span>
                    {expl}
                  </li>
                ))}
                {allExplanations.length === 0 && <li className="text-[11px] text-text-secondary">Standard estimates applying.</li>}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-xs text-text-secondary">
          Effort insights represent raw time tracking vs estimations across the project. 
          No individual performance metrics are ranked.
        </p>
      </div>
    </div>
  );
}
