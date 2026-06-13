import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Users, BatteryMedium, ShieldAlert } from 'lucide-react';
import type { Task } from '../../core/types/execution';

export function TeamCapacityView({ projectId }: { projectId?: string }) {
  const { workspace } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [workspaceSettings, setWorkspaceSettings] = useState<any>(null);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!workspace?.id) {
        setLoading(false);
        return;
      }
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      try {
        let taskQuery = supabase.from('tasks').select('*').eq('workspace_id', workspace.id);
        if (projectId) taskQuery = taskQuery.eq('project_id', projectId);
        
        const { data: t, error: tErr } = await taskQuery;
        if (tErr) throw tErr;
        if (t) setTasks(t as Task[]);

        const { data: p, error: pErr } = await supabase.from('profiles').select('id, full_name, email, role');
        if (pErr) throw pErr;
        if (p) setProfiles(p);

        const { data: ws, error: wsErr } = await supabase
          .from('workspace_settings')
          .select('working_hours')
          .eq('workspace_id', workspace.id)
          .maybeSingle();
        if (ws) setWorkspaceSettings(ws);

        const { data: lv, error: lvErr } = await supabase.from('personal_leave').select('*');
        if (lvErr) throw lvErr;
        if (lv) setLeaves(lv);
      } catch (err) {
        console.error('Failed to load team capacity data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [workspace?.id, projectId]);

  if (loading) return <div className="p-8 text-center text-xs text-text-tertiary animate-pulse">Loading Capacity Data...</div>;

  // Calculate capacity per user based on active tasks
  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'done');
  
  const userWorkloads = new Map<string, { taskCount: number; estimatedHours: number; blockedCount: number }>();
  activeTasks.forEach(t => {
    if (t.assignee_id) {
      const current = userWorkloads.get(t.assignee_id) || { taskCount: 0, estimatedHours: 0, blockedCount: 0 };
      current.taskCount += 1;
      current.estimatedHours += (t.estimated_hours || 0);
      if (t.status === 'blocked') current.blockedCount += 1;
      userWorkloads.set(t.assignee_id, current);
    }
  });

  const workloadArray = Array.from(userWorkloads.entries()).map(([userId, data]) => {
    const profile = profiles.find(p => p.id === userId);
    
    // Check leaves in next 5 days
    let leaveDays = 0;
    const today = new Date();
    for (let i = 0; i < 5; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      
      const onLeave = leaves.some(l => {
        const lAssignee = l.assignee_id || l.user_id;
        if (lAssignee !== userId) return false;
        const startD = new Date(l.start_date).toISOString().split('T')[0];
        const endD = new Date(l.end_date).toISOString().split('T')[0];
        return dateStr >= startD && dateStr <= endD;
      });
      if (onLeave) leaveDays++;
    }

    // Base weekly capacity adjusted by leave days
    const defaultWorkingHours = workspaceSettings?.working_hours || 8;
    const workingDays = Math.max(0, 5 - leaveDays);
    const baseCapacity = defaultWorkingHours * workingDays;
    
    // Apply role-based scaling
    const capacityMultiplier = profile?.role === 'intern' ? 0.6 : 1.0;
    const totalCapacity = baseCapacity * capacityMultiplier;

    return {
      userId,
      name: profile?.full_name || profile?.email || 'Unknown',
      role: profile?.role,
      totalCapacity,
      leaveDays,
      ...data
    };
  });

  return (
    <div className="p-4 bg-surface-2 rounded-xl border border-border mt-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-semibold text-text-primary tracking-tight">Team Capacity & Support</h3>
        </div>
      </div>

      <div className="space-y-4">
        {workloadArray.length === 0 ? (
          <p className="text-xs text-text-tertiary">No active workload data available.</p>
        ) : (
          workloadArray.map(w => {
            const isOverloaded = w.estimatedHours > w.totalCapacity;
            const needsSupport = w.blockedCount > 0 || isOverloaded;

            return (
              <div key={w.userId} className="p-4 bg-surface rounded-lg border border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {w.name} <span className="text-[10px] text-text-tertiary uppercase ml-2 px-1.5 py-0.5 bg-surface-2 rounded">{w.role || 'user'}</span>
                  </p>
                  <p className="text-xs text-text-tertiary mt-1">
                    {w.taskCount} active tasks &middot; <span className={isOverloaded ? 'text-red-400 font-bold' : ''}>{w.estimatedHours}h / {w.totalCapacity}h</span> capacity
                    {w.leaveDays > 0 && <span className="text-purple-400 font-medium ml-1.5">&middot; {w.leaveDays}d approved leave</span>}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  {isOverloaded && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-[var(--signal-critical)] bg-[var(--signal-critical-bg)]/20 text-red-400 rounded text-[10px] font-bold uppercase tracking-wider">
                      <ShieldAlert className="w-3 h-3" />
                      Timeline Risk
                    </div>
                  )}
                  {needsSupport && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded text-[10px] font-bold uppercase tracking-wider">
                      <ShieldAlert className="w-3 h-3" />
                      May Need Support
                    </div>
                  )}
                  {!needsSupport && !isOverloaded && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold uppercase tracking-wider">
                      Optimal Capacity
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-xs text-text-secondary">
          Insights focus on workload distribution and identifying support needs. 
          No individual performance rankings are displayed.
        </p>
      </div>
    </div>
  );
}
