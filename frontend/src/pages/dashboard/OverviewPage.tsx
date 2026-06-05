import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { Icon } from '../../components/ui/Icon';
import { supabase } from '../../lib/supabase';
import { useOperationalDerived, useOperationalData } from '../../context/OperationalDataContext';
import { buildVisibilityContext, filterVisibleTasks } from '../../utils/visibilityFilter';
import { hasCapability } from '../../core/auth/permissions';
import { activityLogService } from '../../services/activityLogService';
import { GettingStartedHub } from '../../components/workspace/GettingStartedHub';
import { ContextualHelp } from '../../components/common/ContextualHelp';
import { PersonalWorkSummary } from '../../components/reports/PersonalWorkSummary';
import { TeamCapacityView } from '../../components/reports/TeamCapacityView';

export default function OverviewPage() {
  const { workspace } = useWorkspace() as any;
  const { profile } = useAuth();
  const { raw: { tasks, teams, profiles }, taskActions: { updateTask } } = useOperationalData();
  const { stats, notify, projects, dependencies = [], workspaceSettingsBlob = {}, updateWorkspaceSettings } = useDashboard() as any;

  const isDeveloper = hasCapability(profile?.role, 'manage_tasks') && !hasCapability(profile?.role, 'manage_projects');
  const isSuperAdmin = hasCapability(profile?.role, 'platform_governance');
  const isPM = hasCapability(profile?.role, 'manage_projects') && !hasCapability(profile?.role, 'platform_governance');

  const visibilityContext = useMemo(() => {
    if (!profile) return null;
    return buildVisibilityContext(
      profile.id,
      profile.role as any,
      projects || [],
      teams || [],
      tasks || [],
      dependencies || [],
      workspaceSettingsBlob
    );
  }, [profile, projects, teams, tasks, dependencies, workspaceSettingsBlob]);

  const visibleTasks = useMemo(() => {
    if (!visibilityContext || !tasks) return [];
    return filterVisibleTasks(tasks, visibilityContext);
  }, [tasks, visibilityContext]);

  if (isDeveloper) {
    return (
      <DeveloperWorkspace
        profile={profile}
        visibleTasks={visibleTasks}
        dependencies={dependencies}
        tasks={tasks}
        workspaceSettingsBlob={workspaceSettingsBlob}
        updateTask={updateTask}
        updateWorkspaceSettings={updateWorkspaceSettings}
        notify={notify}
      />
    );
  }

  if (isPM) {
    return (
      <PMOrchestrationSurface
        profile={profile}
        projects={projects}
        tasks={tasks}
        visibleTasks={visibleTasks}
        dependencies={dependencies}
        workspaceSettingsBlob={workspaceSettingsBlob}
        updateWorkspaceSettings={updateWorkspaceSettings}
        notify={notify}
        profiles={profiles}
        stats={stats}
      />
    );
  }

  if (isSuperAdmin) {
    return (
      <SuperAdminGovernanceSurface
        profile={profile}
        workspace={workspace}
        projects={projects}
        tasks={tasks}
        visibleTasks={visibleTasks}
        profiles={profiles}
        notify={notify}
      />
    );
  }

  // Fallback view (defaults to PM-style analytics)
  return (
    <PMOrchestrationSurface
      profile={profile}
      projects={projects}
      tasks={tasks}
      visibleTasks={visibleTasks}
      dependencies={dependencies}
      workspaceSettingsBlob={workspaceSettingsBlob}
      updateWorkspaceSettings={updateWorkspaceSettings}
      notify={notify}
      profiles={profiles}
      stats={stats}
    />
  );
}

// ─── SUB-COMPONENT: DEVELOPER WORKSPACE ─────────────────────────────────
function DeveloperWorkspace({
  profile,
  visibleTasks,
  dependencies,
  tasks,
  workspaceSettingsBlob,
  updateTask,
  updateWorkspaceSettings,
  notify
}: any) {
  const clockRef = useRef<HTMLSpanElement>(null);
  const [selectedUnblockTask, setSelectedUnblockTask] = useState<any>(null);
  const [unblockReason, setUnblockReason] = useState('');
  const [releaseCountdown, setReleaseCountdown] = useState('');
  const [userMap, setUserMap] = useState<Record<string, { full_name: string; avatar_url?: string }>>({});

  useEffect(() => {
    supabase.from('users')
      .select('id, full_name, avatar_url')
      .then(({ data }) => {
        if (data) {
          const map: Record<string, { full_name: string; avatar_url?: string }> = {};
          data.forEach(u => map[u.id] = { full_name: u.full_name, avatar_url: u.avatar_url });
          setUserMap(map);
        }
      });
  }, []);

  const devOpenTasks = useMemo(() => {
    return visibleTasks?.filter((t: any) => t.assignee_id === profile?.id && t.status !== 'done') || [];
  }, [visibleTasks, profile?.id]);

  const devCompletedTasks = useMemo(() => {
    return visibleTasks?.filter((t: any) => t.assignee_id === profile?.id && t.status === 'done') || [];
  }, [visibleTasks, profile?.id]);

  const devCompletedWeight = useMemo(() => {
    return devCompletedTasks.reduce((sum: number, t: any) => sum + (t.estimated_hours || 0), 0);
  }, [devCompletedTasks]);

  const devBlockedTasks = useMemo(() => {
    return devOpenTasks.filter((t: any) => {
      const deps = dependencies.filter((d: any) => d.task_id === t.id);
      return deps.some((d: any) => {
        const depTask = tasks?.find((pt: any) => pt.id === d.depends_on_task_id);
        return depTask && depTask.status !== 'done';
      });
    });
  }, [devOpenTasks, dependencies, tasks]);

  const devTotalHrs = useMemo(() => {
    return devOpenTasks.reduce((sum: number, t: any) => sum + (t.estimated_hours || 0), 0);
  }, [devOpenTasks]);

  const devCapacity = 40 * (profile?.availability_factor || 1.0);
  const devOverloadStatus = devTotalHrs > devCapacity;

  useEffect(() => {
    const tick = () => {
      if (!clockRef.current) return;
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      clockRef.current.textContent = `${h}:${m}:${s} UTC`;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const nextFriday = new Date();
      nextFriday.setUTCDate(now.getUTCDate() + ((5 - now.getUTCDay() + 7) % 7));
      nextFriday.setUTCHours(18, 0, 0, 0);
      if (nextFriday.getTime() <= now.getTime()) {
        nextFriday.setUTCDate(nextFriday.getUTCDate() + 7);
      }
      const diff = nextFriday.getTime() - now.getTime();
      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setReleaseCountdown(`${hrs}h ${mins}m ${secs}s`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const devDependencies = useMemo(() => {
    if (!visibleTasks) return { upstream: [], downstream: [] };
    const myAssignedIds = new Set(visibleTasks.filter((t: any) => t.assignee_id === profile?.id).map((t: any) => t.id));
    
    const upstream: any[] = [];
    const downstream: any[] = [];
    
    dependencies.forEach((d: any) => {
      if (myAssignedIds.has(d.task_id)) {
        const depTask = visibleTasks.find((t: any) => t.id === d.depends_on_task_id);
        if (depTask) upstream.push({ dep: d, task: depTask });
      }
      if (myAssignedIds.has(d.depends_on_task_id)) {
        const dependentTask = visibleTasks.find((t: any) => t.id === d.task_id);
        if (dependentTask) downstream.push({ dep: d, task: dependentTask });
      }
    });
    
    return { upstream, downstream };
  }, [visibleTasks, dependencies, profile?.id]);

  const deploymentTasks = useMemo(() => {
    if (!visibleTasks) return [];
    const taskSubStates = workspaceSettingsBlob?.task_substates || {};
    return visibleTasks.filter((t: any) => {
      const sub = taskSubStates[t.id];
      return sub === 'DEPLOYING' || sub === 'RELEASE_WINDOW_PENDING';
    });
  }, [visibleTasks, workspaceSettingsBlob?.task_substates]);

  const taskSubStates = workspaceSettingsBlob?.task_substates || {};
  const blockers = workspaceSettingsBlob?.execution_blockers || [];

  const handleUpdateSubState = async (taskId: string, substate: string) => {
    const updatedSubStates = {
      ...(workspaceSettingsBlob?.task_substates || {}),
      [taskId]: substate
    };
    
    const { mapToTaskStatus } = await import('../../core/execution/executionBrain');
    const legacyStatus = mapToTaskStatus(substate as any);
    
    if (updateTask) {
      await updateTask(taskId, { status: legacyStatus });
    }

    if (updateWorkspaceSettings) {
      await updateWorkspaceSettings({ task_substates: updatedSubStates });
      notify(`Execution sub-state updated to ${substate}.`, "success");
    }
  };

  const handleSendUnblockRequest = async (taskId: string, message: string) => {
    if (!message.trim()) return;

    // Check if the blocker already exists, if so append, else create one
    const blockerIndex = blockers.findIndex((b: any) => b.task_id === taskId && !b.resolved);
    let updatedBlockers = [...blockers];

    if (blockerIndex > -1) {
      const b = updatedBlockers[blockerIndex];
      updatedBlockers[blockerIndex] = {
        ...b,
        history: [
          ...(b.history || []),
          {
            status: 'owner_assigned',
            timestamp: new Date().toISOString(),
            actor_id: profile?.id || 'unknown',
            notes: `UNBLOCK REQUEST: ${message}`
          }
        ]
      };
    } else {
      updatedBlockers.push({
        task_id: taskId,
        resolved: false,
        created_at: new Date().toISOString(),
        owner_id: null,
        history: [
          {
            status: 'owner_assigned',
            timestamp: new Date().toISOString(),
            actor_id: profile?.id || 'unknown',
            notes: `UNBLOCK REQUEST: ${message}`
          }
        ]
      });
    }

    if (updateWorkspaceSettings) {
      await updateWorkspaceSettings({ execution_blockers: updatedBlockers });
      notify("Roadblock coordination update logged and PM notified.", "success");
      setUnblockReason('');
      setSelectedUnblockTask(null);
    } else {
      notify("Failed to dispatch unblock request.", "error");
    }
  };

  return (
    <div className="space-y-8 pb-16 font-geist text-[var(--pm-primary)]" style={{ color: 'var(--pm-on-surface)' }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--pm-on-surface)' }}>
            My Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Welcome {profile?.full_name?.split(' ')[0] || 'User'}. Your workspace is ready.
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-border bg-surface-2"
          style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 operational-pulse" style={{ boxShadow: '0 0 8px rgba(129,140,248,0.5)' }} />
          <span id="clock" ref={clockRef} className="font-mono-pm text-xs uppercase tracking-widest text-[var(--pm-on-surface-variant)]" style={{ color: 'var(--pm-on-surface-variant)' }}>
             UTC
          </span>
        </div>
      </div>

      {/* KPI metrics bar */}
      {(devOpenTasks.length > 0 || devCompletedTasks.length > 0) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { label: 'My Open Tasks', value: devOpenTasks.length, sub: `${devCompletedTasks.length} completed`, icon: 'assignment', color: 'var(--pm-primary)' },
            { label: 'Completed Weight', value: `${devCompletedWeight}h`, sub: 'Total effort delivered', icon: 'history', color: '#34d399' },
            { label: 'Active Blockers', value: devBlockedTasks.length, sub: 'Blocked by dependencies', icon: 'lock', color: devBlockedTasks.length > 0 ? 'var(--pm-error)' : 'var(--pm-primary)' },
            { label: 'My Completion Rate', value: `${devOpenTasks.length + devCompletedTasks.length > 0 ? Math.round((devCompletedTasks.length / (devOpenTasks.length + devCompletedTasks.length)) * 100) : 0}%`, sub: 'Personal throughput', icon: 'check_circle', color: '#34d399' }
          ].map((kpi, i) => (
            <div key={i} className="pm-card p-5 relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${kpi.color}18`, border: `1px solid ${kpi.color}30` }}>
                  <Icon name={kpi.icon} size={20} style={{ color: kpi.color }} />
                </div>
                <span className="font-mono-pm text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>LIVE</span>
              </div>
              <div className="text-3xl font-bold tracking-tight" style={{ color: kpi.color }}>{kpi.value}</div>
              <div className="text-[11px] font-semibold mt-1 mb-0.5" style={{ color: 'var(--pm-on-surface)' }}>{kpi.label}</div>
              <div className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>{kpi.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Primary Execution Workspace Grid ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Assigned Tasks & Neighboring Dependencies */}
        <div className="lg:col-span-8 space-y-6">
          {/* Active Assigned Work */}
          <div className="glass-panel rounded-xl p-6 bg-surface-2 border border-border">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-[var(--pm-primary)]">Assigned Work Console</h2>
              <span className="font-mono-pm text-[10px] uppercase text-[var(--pm-on-surface-variant)]">FULL ACCESS ({devOpenTasks.length} active)</span>
            </div>
            <div className="space-y-4">
              {devOpenTasks.length > 0 ? (
                devOpenTasks.map((t: any) => {
                  const sub = taskSubStates[t.id] || 'EXECUTING';
                  const isBlocked = devBlockedTasks.some((bt: any) => bt.id === t.id);
                  return (
                    <div key={t.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl transition-all gap-4 bg-surface-2 border border-border"
                      style={{ 
                        background: isBlocked ? 'rgba(239, 68, 68, 0.04)' : 'var(--pm-surface-high)', 
                        borderColor: isBlocked ? 'rgba(239, 68, 68, 0.2)' : 'rgba(70,69,84,0.3)' 
                      }}>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--pm-primary)]" style={{ color: 'var(--pm-on-surface)' }}>{t.name}</span>
                          {t.risk === 'high' && (
                            <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] px-1.5 py-0.5 rounded uppercase font-mono-pm">HIGH RISK</span>
                          )}
                          {isBlocked && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-mono-pm bg-red-500/10 text-red-400 border border-red-500/20">BLOCKED</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 font-mono-pm text-[11px] text-[var(--pm-on-surface-variant)]">
                          <span>EST: <strong className="text-[var(--pm-primary)]">{t.estimated_hours}h</strong></span>
                          <span>•</span>
                          <span>PRIORITY: <strong style={{ color: t.priority === 'urgent' ? 'var(--pm-error)' : 'var(--pm-on-surface)' }}>{t.priority?.toUpperCase()}</strong></span>
                          {t.deadline && (
                            <>
                              <span>•</span>
                              <span>DUE: <strong className="text-[var(--pm-primary)]">{new Date(t.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong></span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-mono-pm text-[9px] uppercase text-right mr-1 text-[var(--pm-on-surface-variant)]">SUB-STATE</span>
                          <select
                            value={sub}
                            onChange={(e) => handleUpdateSubState(t.id, e.target.value)}
                            className="px-3 py-1.5 rounded-lg text-xs font-mono-pm border cursor-pointer uppercase transition-colors bg-surface-3 text-[var(--pm-primary)] border-border"
                          >
                            <optgroup label="ACTIVE" className="bg-surface-3">
                              <option value="EXECUTING">EXECUTING</option>
                              <option value="DEPLOYING">DEPLOYING</option>
                              <option value="TESTING">TESTING</option>
                              <option value="VALIDATING">VALIDATING</option>
                            </optgroup>
                            <optgroup label="WAITING" className="bg-surface-3">
                              <option value="WAITING_FOR_CLIENT">WAITING FOR CLIENT</option>
                              <option value="WAITING_FOR_DATA">WAITING FOR DATA</option>
                              <option value="WAITING_FOR_INFRASTRUCTURE">WAITING FOR INFRASTRUCTURE</option>
                              <option value="WAITING_FOR_APPROVAL">WAITING FOR APPROVAL</option>
                            </optgroup>
                            <optgroup label="BLOCKED" className="bg-surface-3">
                              <option value="BLOCKED_DEPENDENCY">BLOCKED DEPENDENCY</option>
                              <option value="BLOCKED_INFRASTRUCTURE">BLOCKED INFRASTRUCTURE</option>
                              <option value="BLOCKED_ACCESS">BLOCKED ACCESS</option>
                            </optgroup>
                            <optgroup label="COORDINATION" className="bg-surface-3">
                              <option value="CLIENT_VERIFICATION">CLIENT VERIFICATION</option>
                              <option value="RELEASE_WINDOW_PENDING">RELEASE WINDOW PENDING</option>
                              <option value="INTERNAL_REVIEW">INTERNAL REVIEW</option>
                            </optgroup>
                          </select>
                        </div>
                        
                        <button
                          onClick={() => setSelectedUnblockTask(t)}
                          className="px-3 py-2 rounded-lg text-[10px] font-mono-pm uppercase tracking-wider bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all cursor-pointer self-end"
                        >
                          Unblock Request
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Icon name="assignment" size={36} style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.3 }} />
                  <p className="text-sm font-medium text-[var(--pm-on-surface-variant)] text-center">
                    No assigned tasks yet.<br/>Your work will appear here when your manager assigns tasks.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Neighboring Execution Dependencies */}
          <div className="glass-panel rounded-xl p-6 bg-surface-2 border border-border">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-[var(--pm-primary)]">Neighboring Dependencies Map</h2>
              <span className="font-mono-pm text-[10px] uppercase text-[var(--pm-on-surface-variant)]">LIMITED VISIBILITY (Upstream & Downstream)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Upstream Dependencies */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider font-mono-pm text-indigo-400">▲ Upstream (What I Wait For)</h3>
                {devDependencies.upstream.length > 0 ? (
                  devDependencies.upstream.map(({ dep, task }: any) => (
                    <div key={dep.task_id + '-' + dep.depends_on_task_id} className="p-3 rounded-lg border bg-surface-3 border-border flex flex-col gap-1.5">
                      <span className="text-xs font-semibold text-[var(--pm-primary)]">{task.name}</span>
                      <div className="flex items-center justify-between text-[10px] font-mono-pm text-[var(--pm-on-surface-variant)]">
                        <span>STATUS: <strong className="text-indigo-400">{task.status?.toUpperCase()}</strong></span>
                        <span>ASSIGNEE: <strong>{task.assignee_id ? (userMap[task.assignee_id]?.full_name?.split(' ')[0] || 'Assigned') : 'Unassigned'}</strong></span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs py-4 text-center font-mono-pm text-text-tertiary">No active upstream blocks.</p>
                )}
              </div>

              {/* Downstream Dependents */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider font-mono-pm text-amber-400">▼ Downstream (Who Waits For Me)</h3>
                {devDependencies.downstream.length > 0 ? (
                  devDependencies.downstream.map(({ dep, task }: any) => (
                    <div key={dep.task_id + '-' + dep.depends_on_task_id} className="p-3 rounded-lg border bg-surface-3 border-border flex flex-col gap-1.5">
                      <span className="text-xs font-semibold text-[var(--pm-primary)]">{task.name}</span>
                      <div className="flex items-center justify-between text-[10px] font-mono-pm text-[var(--pm-on-surface-variant)]">
                        <span>STATUS: <strong className="text-red-400">BLOCKED</strong></span>
                        <span>ASSIGNEE: <strong>{task.assignee_id ? (userMap[task.assignee_id]?.full_name?.split(' ')[0] || 'Assigned') : 'Unassigned'}</strong></span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs py-4 text-center font-mono-pm text-text-tertiary">No employees waiting on your tasks.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Blockers Coordinator, Required Approvals, Release Countdown */}
        <div className="lg:col-span-4 space-y-6">
          {/* Blocker Unblock Coordinator */}
          {selectedUnblockTask ? (
            <div className="rounded-xl p-5 border flex flex-col gap-4 bg-red-950/10 border-red-900/30">
              <div className="flex items-center justify-between border-b pb-3 border-red-900/20">
                <div className="flex items-center gap-2">
                  <Icon name="warning" size={16} style={{ color: 'var(--pm-error)' }} />
                  <span className="text-xs font-semibold font-mono-pm uppercase tracking-widest text-red-400">Roadblock Coordinator</span>
                </div>
                <button onClick={() => setSelectedUnblockTask(null)} className="text-red-400 hover:text-text-primary transition-colors cursor-pointer text-xs font-mono-pm uppercase">Close</button>
              </div>
              
              <div className="text-xs">
                <p className="font-semibold text-[var(--pm-primary)] mb-1">TASK:</p>
                <p className="text-[var(--pm-on-surface-variant)]">{selectedUnblockTask.name}</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono-pm text-[9px] uppercase tracking-wider text-[var(--pm-on-surface-variant)]">Unblock Request / Coordination Notes</label>
                <textarea
                  value={unblockReason}
                  onChange={(e) => setUnblockReason(e.target.value)}
                  placeholder="Enter what resources, data, or approvals are needed to clear this block..."
                  className="p-3 rounded-lg text-xs font-mono-pm min-h-[90px] border transition-colors outline-none bg-surface-3 text-[var(--pm-primary)] border-border"
                />
              </div>

              <button
                onClick={() => handleSendUnblockRequest(selectedUnblockTask.id, unblockReason)}
                disabled={!unblockReason.trim()}
                className="w-full py-2 rounded-lg text-xs font-mono-pm uppercase tracking-widest bg-red-500 text-text-primary font-semibold hover:bg-red-600 disabled:opacity-50 transition-all cursor-pointer text-center"
              >
                Send Unblock Signal
              </button>
            </div>
          ) : (
            <div className="glass-panel rounded-xl p-5 bg-surface-2 border border-border flex flex-col items-center justify-center text-center min-h-[160px] gap-2">
              <Icon name="lock" size={24} style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.4 }} />
              <h3 className="text-xs font-semibold uppercase tracking-wider font-mono-pm text-[var(--pm-on-surface-variant)]">Blocker Coordinator</h3>
              <p className="text-[11px] text-text-tertiary">Select "Unblock Request" on any blocked task to notify project managers.</p>
            </div>
          )}

          {/* Required Approvals & Coordination */}
          <div className="glass-panel rounded-xl p-5 bg-surface-2 border border-border space-y-4">
            <div className="flex items-center gap-2 border-b pb-3 border-border">
              <Icon name="check_circle" size={16} style={{ color: 'var(--pm-primary)' }} />
              <h3 className="text-xs font-semibold uppercase tracking-widest font-mono-pm text-[var(--pm-primary)]">Approvals & waiting states</h3>
            </div>
            <div className="space-y-3">
              {devOpenTasks.some((t: any) => ['WAITING_FOR_APPROVAL', 'INTERNAL_REVIEW', 'CLIENT_VERIFICATION'].includes(taskSubStates[t.id])) ? (
                devOpenTasks.filter((t: any) => ['WAITING_FOR_APPROVAL', 'INTERNAL_REVIEW', 'CLIENT_VERIFICATION'].includes(taskSubStates[t.id])).map((t: any) => (
                  <div key={t.id} className="p-3 rounded-lg border bg-surface-3 border-border flex flex-col gap-1.5 text-xs">
                    <span className="font-semibold text-[var(--pm-primary)]">{t.name}</span>
                    <div className="flex items-center justify-between text-[10px] font-mono-pm text-[var(--pm-on-surface-variant)]">
                      <span className="text-amber-400 font-bold uppercase">{taskSubStates[t.id]?.replace(/_/g, ' ')}</span>
                      <span>EST: {t.estimated_hours}h</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[11px] py-4 text-center font-mono-pm text-text-tertiary">No tasks waiting for review or approval.</p>
              )}
            </div>
          </div>

          {/* Release Countdown */}
          <div className="rounded-xl p-5 border bg-indigo-950/5 border-indigo-900/20 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b pb-3 border-indigo-900/20">
              <Icon name="schedule" size={16} style={{ color: 'var(--pm-primary)' }} />
              <h3 className="text-xs font-semibold uppercase tracking-widest font-mono-pm text-indigo-400">Release coordination</h3>
            </div>

            <div className="flex flex-col items-center justify-center py-2 text-center">
              <span className="font-mono-pm text-[9px] uppercase tracking-[0.2em] text-indigo-400 mb-1">NEXT WEEKLY PROD ROLLOUT</span>
              <span className="text-2xl font-bold tracking-wider font-mono-pm text-text-primary">{releaseCountdown || '00h 00m 00s'}</span>
              <span className="text-[10px] mt-1 text-text-tertiary">Friday 18:00 UTC Rollout Cadence</span>
            </div>

            {deploymentTasks.length > 0 && (
              <div className="space-y-2 mt-2">
                <span className="font-mono-pm text-[9px] uppercase tracking-wider block text-[var(--pm-on-surface-variant)]">ACTIVE INTEGRATIONS ({deploymentTasks.length})</span>
                {deploymentTasks.map((dt: any) => (
                  <div key={dt.id} className="p-2.5 rounded bg-surface-3 border border-border flex items-center justify-between text-xs text-[var(--pm-secondary)]">
                    <span className="truncate max-w-[150px]">{dt.name}</span>
                    <span className="font-mono-pm text-[10px] text-indigo-300 uppercase">{taskSubStates[dt.id]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <PersonalWorkSummary />
      </div>
    </div>
  );
}

// ─── SUB-COMPONENT: PM ORCHESTRATION SURFACE ─────────────────────────────
function PMOrchestrationSurface({
  profile,
  projects,
  tasks,
  visibleTasks,
  dependencies,
  workspaceSettingsBlob,
  updateWorkspaceSettings,
  notify,
  profiles,
  stats
}: any) {
  const { globalFrictionSummary } = useOperationalDerived();
  const [pmNotesMap, setPmNotesMap] = useState<Record<string, string>>({});

  const activeProjectsCount = projects?.filter((p: any) => p.status !== 'deployed').length || 0;
  const completedProjectsCount = projects?.filter((p: any) => p.status === 'deployed').length || 0;
  const activeTasks = visibleTasks?.filter((t: any) => t.status !== 'done') || [];
  const completedTasks = visibleTasks?.filter((t: any) => t.status === 'done') || [];
  const totalTasks = visibleTasks?.length || 0;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;
  const deliveryConfidence = stats?.deliveryConfidence;

  const blockers = workspaceSettingsBlob?.execution_blockers || [];
  const activeBlockers = blockers.filter((b: any) => !b.resolved);

  const handleResolveBlocker = async (taskId: string, notes?: string) => {
    const updatedBlockers = blockers.map((b: any) => {
      if (b.task_id === taskId && !b.resolved) {
        return {
          ...b,
          resolved: true,
          resolved_at: new Date().toISOString(),
          history: [
            ...(b.history || []),
            {
              status: 'resolved',
              timestamp: new Date().toISOString(),
              actor_id: profile?.id || 'unknown',
              notes: notes || 'Roadblock resolved by project manager.'
            }
          ]
        };
      }
      return b;
    });

    if (updateWorkspaceSettings) {
      await updateWorkspaceSettings({ execution_blockers: updatedBlockers });
      notify("Roadblock marked as resolved.", "success");
    }
  };

  const handleAssignBlockerOwner = async (taskId: string, ownerId: string) => {
    const updatedBlockers = blockers.map((b: any) => {
      if (b.task_id === taskId && !b.resolved) {
        const ownerProfile = profiles.find((p: any) => p.id === ownerId);
        const ownerName = ownerProfile ? (ownerProfile.full_name || ownerProfile.email) : ownerId;
        return {
          ...b,
          owner_id: ownerId,
          history: [
            ...(b.history || []),
            {
              status: 'owner_assigned',
              timestamp: new Date().toISOString(),
              actor_id: profile?.id || 'unknown',
              notes: `Ownership assigned to ${ownerName}`
            }
          ]
        };
      }
      return b;
    });

    if (updateWorkspaceSettings) {
      await updateWorkspaceSettings({ execution_blockers: updatedBlockers });
      notify("Roadblock owner updated.", "success");
    }
  };

  const handlePostBlockerNote = async (taskId: string) => {
    const noteText = pmNotesMap[taskId];
    if (!noteText || !noteText.trim()) return;

    const updatedBlockers = blockers.map((b: any) => {
      if (b.task_id === taskId && !b.resolved) {
        return {
          ...b,
          history: [
            ...(b.history || []),
            {
              status: 'owner_assigned',
              timestamp: new Date().toISOString(),
              actor_id: profile?.id || 'unknown',
              notes: `PM UPDATE: ${noteText.trim()}`
            }
          ]
        };
      }
      return b;
    });

    if (updateWorkspaceSettings) {
      await updateWorkspaceSettings({ execution_blockers: updatedBlockers });
      notify("Coordination update logged.", "success");
      setPmNotesMap(prev => ({ ...prev, [taskId]: '' }));
    }
  };

  // Find active task dependencies where upstream tasks are incomplete
  const activeDependencyHandoffs = useMemo(() => {
    const list: any[] = [];
    if (!tasks || !dependencies) return list;

    activeTasks.forEach((t: any) => {
      const deps = dependencies.filter((d: any) => d.task_id === t.id);
      deps.forEach((d: any) => {
        const depTask = tasks.find((x: any) => x.id === d.depends_on_task_id);
        if (depTask && depTask.status !== 'done') {
          const waitingAssignee = profiles.find((p: any) => p.id === t.assignee_id);
          const blockerAssignee = profiles.find((p: any) => p.id === depTask.assignee_id);
          list.push({
            id: `${t.id}-${depTask.id}`,
            task: t,
            waitingName: waitingAssignee?.full_name || waitingAssignee?.email || 'Unassigned',
            dependsOn: depTask,
            blockerName: blockerAssignee?.full_name || blockerAssignee?.email || 'Unassigned',
          });
        }
      });
    });

    return list;
  }, [tasks, dependencies, activeTasks, profiles]);

  return (
    <div className="space-y-8 pb-16 font-geist text-[var(--pm-primary)]" style={{ color: 'var(--pm-on-surface)' }}>
      <GettingStartedHub />
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Manager Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Project progress, team workload, and delivery metrics.
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-border bg-surface-2"
          style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 operational-pulse" />
          <span className="font-mono-pm text-xs uppercase tracking-widest text-[var(--pm-on-surface-variant)]">MANAGER VIEW</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { 
            label: 'Active Initiatives', value: activeProjectsCount, sub: `+${completedProjectsCount} deployed`, icon: 'inventory_2', color: 'var(--pm-primary)',
            explanation: 'Count of projects currently in execution phase. Deployed projects are archived.'
          },
          { 
            label: 'Active Tasks', value: activeTasks.length, sub: `${completedTasks.length} resolved`, icon: 'assignment', color: 'var(--pm-primary)',
            explanation: 'Tasks currently assigned and actively moving through the execution board.'
          },
          { 
            label: 'Completion Rate', value: `${completionRate}%`, sub: 'Platform throughput', icon: 'check_circle', color: '#34d399',
            explanation: 'Ratio of completed tasks versus total tasks across all visible projects. A high completion rate indicates strong delivery momentum.'
          },
          { 
            label: 'Delivery Confidence', 
            value: deliveryConfidence !== undefined ? `${deliveryConfidence}%` : '...', 
            sub: 'PERT confidence index', 
            icon: 'trending_up', 
            color: deliveryConfidence !== undefined && deliveryConfidence >= 80 ? '#34d399' : '#ff9800',
            explanation: deliveryConfidence !== undefined && deliveryConfidence >= 80 
              ? 'High confidence derived from low estimation variance and stable dependency chains.' 
              : 'Confidence is reduced due to recent estimation drift, active blockers, or overloaded operators in the critical path.'
          }
        ].map((kpi, i) => (
          <div key={i} className="pm-card p-5 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${kpi.color}18`, border: `1px solid ${kpi.color}30` }}>
                <Icon name={kpi.icon} size={20} style={{ color: kpi.color }} />
              </div>
              <div className="flex gap-2 items-center">
                <span className="font-mono-pm text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>LIVE</span>
                <ContextualHelp 
                  topic={kpi.label} 
                  definition={kpi.explanation} 
                  importance="Key portfolio metric for organizational awareness." 
                />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="text-[11px] font-semibold mt-1 mb-0.5" style={{ color: 'var(--pm-on-surface)' }}>{kpi.label}</div>
            <div className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Primary Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Friction Classifier Gauges & Dependency Tracker */}
        <div className="lg:col-span-6 space-y-6">
          {/* Friction categories */}
          <div className="glass-panel rounded-xl p-6 bg-surface-2 border border-border relative group/friction">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-base font-semibold text-indigo-300">Wait-Time & Friction Analytics</h2>
              <div className="relative group/tooltip">
                <Icon name="info" size={16} style={{ color: 'var(--pm-on-surface-variant)', cursor: 'pointer' }} />
                <div className="absolute hidden group-hover/tooltip:block right-0 top-6 w-64 p-3 bg-surface-high border border-border text-xs rounded shadow-lg z-10 text-[var(--pm-secondary)]">
                  <p className="font-semibold text-[var(--pm-primary)] mb-1">How this is calculated:</p>
                  <p>Wait-time ratio compares hours spent in 'Waiting'/'Blocked' sub-states against total active execution time. Friction categories aggregate historical resolution delays for dependencies, infrastructure outages, and coordination approvals.</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-surface-3 border border-border text-center">
                <span className="font-mono-pm text-[9px] uppercase tracking-[0.2em] text-indigo-400 block mb-1">AVERAGE PORTFOLIO WAIT-TIME LATENCY</span>
                <div className="text-3xl font-bold tracking-tight text-text-primary font-mono-pm">{globalFrictionSummary?.avgWaitTimeRatio ?? 0}%</div>
                <p className="text-[11px] mt-1.5 text-[var(--pm-on-surface-variant)]">Delivery cycle stalled in waiting states or dependency bottlenecks.</p>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Blocker Recurrence', score: globalFrictionSummary?.globalFrictionCategories?.blockerRecurrence ?? 0, color: 'var(--pm-error)' },
                  { label: 'Dependency Instability', score: globalFrictionSummary?.globalFrictionCategories?.dependencyInstability ?? 0, color: '#ff9800' },
                  { label: 'Client Responsiveness', score: globalFrictionSummary?.globalFrictionCategories?.clientResponsiveness ?? 0, color: '#3f51b5' },
                  { label: 'Coordination Overhead', score: globalFrictionSummary?.globalFrictionCategories?.coordinationOverhead ?? 0, color: '#e91e63' },
                  { label: 'Infrastructure Reliability', score: globalFrictionSummary?.globalFrictionCategories?.infrastructureReliability ?? 0, color: 'var(--pm-primary)' },
                ].map((c, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--pm-secondary)] font-medium">{c.label}</span>
                      <span className="font-mono-pm text-[var(--pm-on-surface-variant)]">{c.score}/100</span>
                    </div>
                    <div className="h-2 w-full rounded-full overflow-hidden bg-surface-3">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${c.score}%`, background: c.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dependency Handoffs */}
          <div className="glass-panel rounded-xl p-6 bg-surface-2 border border-border">
            <h2 className="text-base font-semibold mb-4 text-[var(--pm-primary)]">Dependency Handoff Tracker</h2>
            <div className="space-y-3">
              {activeDependencyHandoffs.length > 0 ? (
                activeDependencyHandoffs.map((handoff) => (
                  <div key={handoff.id} className="p-3 rounded-lg border bg-surface-3 border-border flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-rose-400">Blocked Task: {handoff.task.name}</span>
                      <span className="text-[10px] text-text-tertiary font-mono-pm">Assignee: {handoff.waitingName}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] bg-surface-2 p-2 rounded border border-border">
                      <span className="text-[var(--pm-secondary)] font-medium">Waiting on: {handoff.dependsOn.name}</span>
                      <span className="font-mono-pm text-[9px] uppercase px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">{handoff.blockerName} ({handoff.dependsOn.status})</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-text-tertiary py-6 text-center font-mono-pm">No cross-task dependency bottlenecks detected.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Blocker Coordinator */}
        <div className="lg:col-span-6 space-y-6">
          <div className="glass-panel rounded-xl p-6 bg-surface-2 border border-border">
            <h2 className="text-base font-semibold mb-4 text-[var(--pm-primary)]">Active Roadblocks Coordinator</h2>
            
            <div className="space-y-5">
              {activeBlockers.length > 0 ? (
                activeBlockers.map((b: any) => {
                  const taskObj = tasks.find((t: any) => t.id === b.task_id);
                  const lastUpdate = b.history?.[b.history.length - 1];
                  return (
                    <div key={b.task_id} className="p-4 rounded-xl border bg-surface-3 border-border space-y-4">
                      <div className="flex justify-between items-start border-b border-border pb-2">
                        <div>
                          <h4 className="text-xs font-bold text-red-400 font-mono-pm uppercase">ROADBLOCK DETECTED</h4>
                          <h3 className="text-sm font-semibold text-[var(--pm-primary)] mt-1">{taskObj?.name || 'Unknown Task'}</h3>
                        </div>
                        <button
                          onClick={() => handleResolveBlocker(b.task_id)}
                          className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded text-[10px] uppercase font-mono-pm"
                        >
                          Mark Resolved
                        </button>
                      </div>

                      <div className="text-xs space-y-1.5">
                        {lastUpdate && (
                          <div className="p-2.5 rounded bg-surface-2 border border-border">
                            <span className="font-mono-pm text-[9px] text-text-tertiary block uppercase">LAST COORDINATION EVENT</span>
                            <p className="text-[var(--pm-secondary)] mt-1">{lastUpdate.notes}</p>
                            <span className="text-[9px] text-text-tertiary mt-1 block">
                              Logged: {new Date(lastUpdate.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Controls: Assign Owner & Add Update */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-mono-pm uppercase text-[var(--pm-on-surface-variant)]">Assign Owner</label>
                          <select
                            value={b.owner_id || ''}
                            onChange={(e) => handleAssignBlockerOwner(b.task_id, e.target.value)}
                            className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-[var(--pm-primary)] outline-none"
                          >
                            <option value="">Unassigned</option>
                            {profiles.map((p: any) => (
                              <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-mono-pm uppercase text-[var(--pm-on-surface-variant)]">Post Coordination Update</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={pmNotesMap[b.task_id] || ''}
                              onChange={(e) => setPmNotesMap(prev => ({ ...prev, [b.task_id]: e.target.value }))}
                              placeholder="Type note..."
                              className="bg-surface-2 border border-border rounded px-2.5 py-1 text-xs text-[var(--pm-primary)] outline-none flex-1"
                            />
                            <button
                              onClick={() => handlePostBlockerNote(b.task_id)}
                              className="px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 rounded text-xs"
                            >
                              Send
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-text-tertiary py-10 text-center font-mono-pm">No active roadblocks currently reported.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <TeamCapacityView />
      </div>
    </div>
  );
}

// ─── SUB-COMPONENT: SUPER ADMIN GOVERNANCE SURFACE ──────────────────────
function SuperAdminGovernanceSurface({
  profile,
  workspace,
  projects,
  tasks,
  visibleTasks,
  profiles,
  notify
}: any) {
  const [chainIntegrity, setChainIntegrity] = useState<any>(null);
  const [verifyingChain, setVerifyingChain] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  const activeProjectsCount = projects?.filter((p: any) => p.status !== 'deployed').length || 0;
  const totalTasks = tasks?.length || 0;
  const userCount = profiles?.length || 0;

  // Blockchain Hash integrity check on load
  useEffect(() => {
    if (workspace?.id) {
      setVerifyingChain(true);
      activityLogService.verifyHashChain(workspace.id).then(res => {
        setChainIntegrity(res);
        setVerifyingChain(false);
      }).catch(err => {
        console.error(err);
        setVerifyingChain(false);
      });

      // Load recent audit logs
      supabase.from('activity_logs')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(10)
        .then(({ data }) => {
          if (data) setLogs(data);
        });
    }
  }, [workspace?.id, tasks]);

  // Operator workload capacity check
  const overloadedOperators = useMemo(() => {
    return (profiles || []).map((p: any) => {
      const activeDevTasks = (tasks || []).filter((t: any) => t.assignee_id === p.id && t.status !== 'done');
      const activeHours = activeDevTasks.reduce((sum: number, t: any) => sum + (t.estimated_hours || 0), 0);
      const capacity = 40 * (p.availability_factor || 1.0);
      return {
        profile: p,
        activeHours,
        capacity,
        isOverloaded: activeHours > capacity
      };
    }).filter((o: any) => o.isOverloaded);
  }, [profiles, tasks]);

  // High delivery risk deviations
  const riskBreaches = useMemo(() => {
    return (tasks || []).filter((t: any) => t.status !== 'done' && t.risk === 'high');
  }, [tasks]);

  return (
    <div className="space-y-8 pb-16 font-geist text-[var(--pm-primary)]" style={{ color: 'var(--pm-on-surface)' }}>
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            System health, user capacity, and security logs.
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-border bg-surface-2"
          style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 operational-pulse" />
          <span className="font-mono-pm text-xs uppercase tracking-widest text-[var(--pm-on-surface-variant)]">ADMIN</span>
        </div>
      </div>

      {/* Admin KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Active Sprints/Initiatives', value: activeProjectsCount, sub: `Across ${projects?.length || 0} total`, icon: 'inventory_2', color: 'var(--pm-primary)' },
          { label: 'Total Platform Tasks', value: totalTasks, sub: 'System-wide scope', icon: 'assignment', color: 'var(--pm-primary)' },
          { label: 'Managed Contributor Profiles', value: userCount, sub: 'Assigned bandwidth', icon: 'groups', color: '#34d399' },
          { label: 'Active Alerts', value: overloadedOperators.length + riskBreaches.length, sub: 'Unresolved risks', icon: 'warning', color: (overloadedOperators.length + riskBreaches.length) > 0 ? 'var(--pm-error)' : '#34d399' }
        ].map((kpi, i) => (
          <div key={i} className="pm-card p-5 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${kpi.color}18`, border: `1px solid ${kpi.color}30` }}>
                <Icon name={kpi.icon} size={20} style={{ color: kpi.color }} />
              </div>
              <span className="font-mono-pm text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>LIVE</span>
            </div>
            <div className="text-3xl font-bold tracking-tight" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="text-[11px] font-semibold mt-1 mb-0.5" style={{ color: 'var(--pm-on-surface)' }}>{kpi.label}</div>
            <div className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Alerts & Breaches */}
        <div className="lg:col-span-6 space-y-6">
          {/* Capacity Breaches */}
          <div className="glass-panel rounded-xl p-6 bg-surface-2 border border-border">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-base font-semibold text-rose-400 flex items-center gap-2">
                <Icon name="warning" size={18} style={{ color: 'var(--pm-error)' }} />
                Operator Capacity Breaches
              </h2>
              <div className="relative group/tooltip">
                <Icon name="info" size={16} style={{ color: 'var(--pm-on-surface-variant)', cursor: 'pointer' }} />
                <div className="absolute hidden group-hover/tooltip:block right-0 top-6 w-64 p-3 bg-surface-high border border-border text-xs rounded shadow-lg z-10 text-[var(--pm-secondary)]">
                  <p className="font-semibold text-[var(--pm-primary)] mb-1">Why did this alert fire?</p>
                  <p>An operator is assigned more estimated hours than their defined weekly capacity bandwidth (default: 40h * availability factor). Rebalance load to mitigate burnout and timeline drift.</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {overloadedOperators.length > 0 ? (
                overloadedOperators.map((o: any) => (
                  <div key={o.profile.id} className="p-3 rounded-lg border bg-rose-950/10 border-rose-900/30 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-[var(--pm-primary)]">{o.profile.full_name || o.profile.email}</span>
                      <p className="text-[10px] text-[var(--pm-on-surface-variant)] font-mono-pm mt-1">ALLOCATED: {o.activeHours}h (Capacity limit: {o.capacity}h)</p>
                    </div>
                    <span className="text-[9px] font-mono-pm uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">OVERLOAD</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-text-tertiary py-6 text-center font-mono-pm">All operators are within safe bandwidth levels.</p>
              )}
            </div>
          </div>

          {/* Risk Deviations */}
          <div className="glass-panel rounded-xl p-6 bg-surface-2 border border-border">
            <h2 className="text-base font-semibold mb-4 text-amber-400 flex items-center gap-2">
              <Icon name="radar" size={18} style={{ color: '#ff9800' }} />
              High Delivery Risk Tasks
            </h2>
            <div className="space-y-3">
              {riskBreaches.length > 0 ? (
                riskBreaches.map((t: any) => (
                  <div key={t.id} className="p-3 rounded-lg border bg-amber-950/10 border-amber-900/20 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-[var(--pm-primary)]">{t.name}</span>
                      <p className="text-[10px] text-[var(--pm-on-surface-variant)] font-mono-pm mt-1">ESTIMATE: {t.estimated_hours}h · STATUS: {t.status?.replace(/_/g, ' ')}</p>
                    </div>
                    <span className="text-[9px] font-mono-pm uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">HIGH RISK</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-text-tertiary py-6 text-center font-mono-pm">No tasks flagged with critical estimation drift.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Security Logs (Blockchain Hashing) */}
        <div className="lg:col-span-6 space-y-6">
          <div className="glass-panel rounded-xl p-6 bg-surface-2 border border-border">
            <h2 className="text-base font-semibold mb-4 text-indigo-300 flex items-center gap-2">
              <Icon name="shield" size={18} style={{ color: 'var(--pm-primary)' }} />
              Audit Log Blockchain Integrity
            </h2>

            <div className="p-4 rounded-xl border bg-surface-3 border-border flex items-center justify-between">
              <div>
                <span className="font-mono-pm text-[9px] uppercase tracking-widest text-[var(--pm-on-surface-variant)] block mb-1">HASH CHAIN VALIDATION</span>
                {verifyingChain ? (
                  <span className="text-xs text-[var(--pm-on-surface-variant)]">Verifying blocks...</span>
                ) : chainIntegrity ? (
                  <span className="text-sm font-bold" style={{ color: chainIntegrity.status === 'Valid' ? '#34d399' : 'var(--pm-error)' }}>
                    Chain {chainIntegrity.status} ({chainIntegrity.logCount} blocks scanned)
                  </span>
                ) : (
                  <span className="text-xs text-[var(--pm-on-surface-variant)]">Failed to verify audit blockchain</span>
                )}
              </div>
              
              {!verifyingChain && chainIntegrity && (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                  chainIntegrity.status === 'Valid' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  <Icon name={chainIntegrity.status === 'Valid' ? 'check_circle' : 'warning'} size={20} />
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  window.history.pushState(null, '', '/control/audit');
                  window.dispatchEvent(new CustomEvent('popstate'));
                }}
                className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 rounded text-xs font-mono-pm uppercase transition-all"
              >
                Go to Audit Ledger →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
