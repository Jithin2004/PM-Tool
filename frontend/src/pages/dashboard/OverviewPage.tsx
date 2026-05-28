import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { Icon } from '../../components/ui/Icon';
import { supabase } from '../../lib/supabase';
import { useOperationalDerived, useOperationalData } from '../../context/OperationalDataContext';
import { buildVisibilityContext, filterVisibleTasks } from '../../utils/visibilityFilter';
import { hasCapability } from '../../core/auth/permissions';

export default function OverviewPage() {
  const { workspace } = useWorkspace() as any;
  const { tasks, updateTask } = useTasks(workspace?.id) as any;
  const { profile } = useAuth();
  const { raw: { teams } } = useOperationalData();
  const { stats, notify, projects, dependencies = [], workspaceSettingsBlob = {}, updateWorkspaceSettings } = useDashboard() as any;
  const clockRef = useRef<HTMLSpanElement>(null);
  const [velocityPeriod, setVelocityPeriod] = useState('30D');
  const [userMap, setUserMap] = useState<Record<string, { full_name: string; avatar_url?: string }>>({});
  const [selectedUnblockTask, setSelectedUnblockTask] = useState<any>(null);
  const [unblockReason, setUnblockReason] = useState('');
  const [releaseCountdown, setReleaseCountdown] = useState('');

  const { globalFrictionSummary } = useOperationalDerived();

  const isDeveloper = hasCapability(profile?.role, 'manage_tasks') && !hasCapability(profile?.role, 'manage_projects');

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

  // ── Metrics & Open Task Queries ──────────────────────────────
  const activeProjectsCount   = projects?.filter((p: any) => p.status !== 'deployed').length || 0;
  const completedProjectsCount = projects?.filter((p: any) => p.status === 'deployed').length || 0;
  const activeTasks            = visibleTasks?.filter((t: any) => t.status === 'in_progress' || t.status === 'todo' || t.status === 'ready') || [];
  const completedTasks         = visibleTasks?.filter((t: any) => t.status === 'done') || [];
  const totalTasks             = visibleTasks?.length || 0;
  const completionRate         = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;
  const highRiskTasks          = visibleTasks?.filter((t: any) => t.risk === 'high').length || 0;
  const deliveryConfidence     = stats?.deliveryConfidence;
  const riskStatus             = highRiskTasks > 5 ? 'Elevated' : highRiskTasks > 0 ? 'Moderate' : 'Healthy';

  // Developer specific calculations
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

  const devHighRiskTasks = useMemo(() => {
    return devOpenTasks.filter((t: any) => t.risk === 'high');
  }, [devOpenTasks]);

  const devTotalHrs = useMemo(() => {
    return devOpenTasks.reduce((sum: number, t: any) => sum + (t.estimated_hours || 0), 0);
  }, [devOpenTasks]);

  const devCapacity = 40 * (profile?.availability_factor || 1.0);
  const devOverloadStatus = devTotalHrs > devCapacity;

  // ── Velocity chart data ───────────────────────────────────────
  const chartTasks = useMemo(() => {
    if (isDeveloper) {
      return tasks?.filter((t: any) => t.assignee_id === profile?.id && t.status === 'done') || [];
    }
    return completedTasks;
  }, [isDeveloper, tasks, profile?.id, completedTasks]);

  const velocityPoints = useMemo(() => {
    const days = velocityPeriod === '7D' ? 7 : velocityPeriod === '15D' ? 15 : 30;
    const points: number[] = Array(days).fill(0);
    
    if (chartTasks && chartTasks.length > 0) {
      const now = new Date();
      now.setHours(23, 59, 59, 999);
      
      chartTasks.forEach((t: any) => {
        const dateStr = t.updated_at || t.created_at;
        if (!dateStr) return;
        const d = new Date(dateStr);
        const diffTime = now.getTime() - d.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 0 && diffDays < days) {
          points[days - 1 - diffDays] += (t.estimated_hours || 1);
        }
      });
    }
    
    const maxVal = Math.max(10, ...points);
    return { points, maxVal };
  }, [chartTasks, velocityPeriod]);

  const svgPath = useMemo(() => {
    const w = 800, h = 200;
    const { points, maxVal } = velocityPoints;
    
    const pts = points.map((v, i) => ({
      x: (i / Math.max(1, points.length - 1)) * w,
      y: h * 0.95 - (v / maxVal) * (h * 0.8),
    }));
    
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const cx1 = p0.x + (p1.x - p0.x) / 3;
      const cy1 = p0.y;
      const cx2 = p1.x - (p1.x - p0.x) / 3;
      const cy2 = p1.y;
      d += ` C${cx1},${cy1} ${cx2},${cy2} ${p1.x},${p1.y}`;
    }
    
    return { line: d, fill: `${d} V${h} H0 Z`, pts, maxVal };
  }, [velocityPoints]);

  // ── Recent activity ───────────────────────────────────────────
  useEffect(() => {
    if (!workspace?.id) return;
    supabase.from('users')
      .select('id, full_name, avatar_url')
      .eq('workspace_id', workspace.id)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, { full_name: string; avatar_url?: string }> = {};
          data.forEach(u => map[u.id] = { full_name: u.full_name, avatar_url: u.avatar_url });
          setUserMap(map);
        }
      });
  }, [workspace?.id]);

  const recentActivity = useMemo(() => {
    const rawList = isDeveloper
      ? (tasks || []).filter((t: any) => t.assignee_id === profile?.id || t.created_by === profile?.id || t.updated_by === profile?.id)
      : (tasks || []);

    return [...rawList]
      .sort((a, b) => new Date(b.updated_at || b.created_at || Date.now()).getTime() - new Date(a.updated_at || a.created_at || Date.now()).getTime())
      .slice(0, 5)
      .map((t: any) => {
        const actorId = t.updated_by || t.created_by || t.assignee_id || t.assigneeId;
        const actor = actorId ? userMap[actorId] : null;
        return {
          id: `task-${t.id}`,
          title: t.name,
          time: new Date(t.updated_at || t.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          status: t.status,
          risk: t.risk,
          actorName: actor?.full_name || 'System',
        };
      });
  }, [tasks, userMap, isDeveloper, profile?.id]);

  const upcomingDeadlines = useMemo(() => {
    if (isDeveloper) {
      return [...(tasks || [])]
        .filter((t: any) => t.assignee_id === profile?.id && t.status !== 'done' && (t.deadline || t.due_date))
        .sort((a, b) => new Date(a.deadline || a.due_date).getTime() - new Date(b.deadline || b.due_date).getTime())
        .slice(0, 3);
    }
    return [...(projects || [])]
      .filter((p: any) => p.status !== 'deployed' && p.deadline)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 3);
  }, [projects, tasks, isDeveloper, profile?.id]);

  // ── Live clock ────────────────────────────────────────────────
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

  const kpis = useMemo(() => {
    if (isDeveloper) {
      return [
        {
          label: 'My Open Tasks',
          value: devOpenTasks.length,
          sub: `${devCompletedTasks.length} completed`,
          icon: 'assignment',
          color: 'var(--pm-primary)',
        },
        {
          label: 'Completed Weight',
          value: `${devCompletedWeight}h`,
          sub: 'Total effort delivered',
          icon: 'history',
          color: '#34d399',
        },
        {
          label: 'Active Blockers',
          value: devBlockedTasks.length,
          sub: 'Blocked by dependencies',
          icon: 'lock',
          color: devBlockedTasks.length > 0 ? 'var(--pm-error)' : 'var(--pm-primary)',
        },
        {
          label: 'My Completion Rate',
          value: `${devOpenTasks.length + devCompletedTasks.length > 0 ? Math.round((devCompletedTasks.length / (devOpenTasks.length + devCompletedTasks.length)) * 100) : 0}%`,
          sub: 'Personal throughput',
          icon: 'check_circle',
          color: '#34d399',
        }
      ];
    }

    return [
      {
        label: 'Active Initiatives',
        value: activeProjectsCount,
        sub: `+${completedProjectsCount} deployed`,
        icon: 'inventory_2',
        color: 'var(--pm-primary)',
      },
      {
        label: 'Active Tasks',
        value: activeTasks.length,
        sub: `${completedTasks.length} resolved`,
        icon: 'assignment',
        color: 'var(--pm-primary)',
      },
      {
        label: 'Completion Rate',
        value: `${completionRate}%`,
        sub: 'Platform throughput',
        icon: 'check_circle',
        color: '#34d399',
      },
      {
        label: 'Delivery Confidence',
        value: deliveryConfidence !== undefined ? `${deliveryConfidence}%` : (
          <span className="inline-block w-16 h-8 bg-white/10 animate-pulse rounded" />
        ),
        sub: 'PERT-weighted estimate',
        icon: 'trending_up',
        color: deliveryConfidence !== undefined
          ? (deliveryConfidence >= 80 ? '#34d399' : deliveryConfidence >= 60 ? 'var(--pm-tertiary)' : 'var(--pm-error)')
          : 'var(--pm-primary)',
      },
    ];
  }, [
    isDeveloper, devOpenTasks.length, devCompletedTasks.length, devCompletedWeight, devBlockedTasks.length,
    activeProjectsCount, completedProjectsCount, activeTasks.length, completedTasks.length, completionRate, deliveryConfidence
  ]);

  // ── Live release window countdown timer ──
  useEffect(() => {
    if (!isDeveloper) return;
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
  }, [isDeveloper]);

  const devDependencies = useMemo(() => {
    if (!isDeveloper || !visibleTasks) return { upstream: [], downstream: [] };
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
  }, [visibleTasks, dependencies, profile?.id, isDeveloper]);

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
    
    const updatedBlockers = blockers.map((b: any) => {
      if (b.task_id === taskId && !b.resolved) {
        const history = b.history || [];
        return {
          ...b,
          history: [
            ...history,
            {
              status: 'owner_assigned',
              timestamp: new Date().toISOString(),
              actor_id: profile?.id || 'unknown',
              notes: `UNBLOCK REQUEST: ${message}`
            }
          ]
        };
      }
      return b;
    });

    if (updateWorkspaceSettings) {
      await updateWorkspaceSettings({ execution_blockers: updatedBlockers });
      notify("Roadblock coordination update logged and PM notified.", "success");
      setUnblockReason('');
      setSelectedUnblockTask(null);
    } else {
      notify("Failed to dispatch unblock request.", "error");
    }
  };

  if (isDeveloper) {
    return (
      <div className="space-y-8 pb-16 font-geist text-slate-100" style={{ color: 'var(--pm-on-surface)' }}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-end justify-between px-1 pt-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--pm-on-surface)' }}>
              {profile?.full_name ? `${profile.full_name.split(' ')[0]}'s Execution Workspace` : 'My Execution Workspace'}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
              Tactical task delivery, active roadblocks, and release coordination.
            </p>
          </div>
          <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-slate-700 bg-slate-900/60"
            style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 operational-pulse" style={{ boxShadow: '0 0 8px rgba(129,140,248,0.5)' }} />
            <span className="font-mono-pm text-xs uppercase tracking-widest text-slate-400" style={{ color: 'var(--pm-on-surface-variant)' }}>
              EXECUTION ACTIVE
            </span>
          </div>
        </div>

        {/* ── Primary Execution Workspace Grid ────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column - Assigned Tasks & Neighboring Dependencies */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Active Assigned Work */}
            <div className="glass-panel rounded-xl p-6 bg-slate-900/40 border border-slate-800">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-slate-200">
                  Assigned Work Console
                </h2>
                <span className="font-mono-pm text-[10px] uppercase text-slate-400">
                  FULL ACCESS ({devOpenTasks.length} active)
                </span>
              </div>

              <div className="space-y-4">
                {devOpenTasks.length > 0 ? (
                  devOpenTasks.map((t: any) => {
                    const sub = taskSubStates[t.id] || (t.status === 'done' ? 'VALIDATING' : t.status === 'review' ? 'TESTING' : 'EXECUTING');
                    const isBlocked = devBlockedTasks.some((bt: any) => bt.id === t.id);
                    return (
                      <div key={t.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl transition-all gap-4 bg-slate-900/60 border border-slate-800"
                        style={{ 
                          background: isBlocked ? 'rgba(239, 68, 68, 0.04)' : 'var(--pm-surface-high)', 
                          borderColor: isBlocked ? 'rgba(239, 68, 68, 0.2)' : 'rgba(70,69,84,0.3)' 
                        }}>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-200" style={{ color: 'var(--pm-on-surface)' }}>{t.name}</span>
                            {t.risk === 'high' && (
                              <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] px-1.5 py-0.5 rounded uppercase font-mono-pm">HIGH RISK</span>
                            )}
                            {isBlocked && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-mono-pm bg-red-500/10 text-red-400 border border-red-500/20">BLOCKED</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 font-mono-pm text-[11px] text-slate-400">
                            <span>EST: <strong className="text-slate-200">{t.estimated_hours}h</strong></span>
                            <span>•</span>
                            <span>PRIORITY: <strong style={{ color: t.priority === 'urgent' ? 'var(--pm-error)' : 'var(--pm-on-surface)' }}>{t.priority?.toUpperCase()}</strong></span>
                            {t.deadline && (
                              <>
                                <span>•</span>
                                <span>DUE: <strong className="text-slate-200">{new Date(t.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong></span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-mono-pm text-[9px] uppercase text-right mr-1 text-slate-400">
                              SUB-STATE
                            </span>
                            <select
                              value={sub}
                              onChange={(e) => handleUpdateSubState(t.id, e.target.value)}
                              className="px-3 py-1.5 rounded-lg text-xs font-mono-pm border cursor-pointer uppercase transition-colors bg-slate-950 text-slate-200 border-slate-700"
                            >
                              <optgroup label="ACTIVE" className="bg-slate-950">
                                <option value="EXECUTING">EXECUTING</option>
                                <option value="DEPLOYING">DEPLOYING</option>
                                <option value="TESTING">TESTING</option>
                                <option value="VALIDATING">VALIDATING</option>
                              </optgroup>
                              <optgroup label="WAITING" className="bg-slate-950">
                                <option value="WAITING_FOR_CLIENT">WAITING FOR CLIENT</option>
                                <option value="WAITING_FOR_DATA">WAITING FOR DATA</option>
                                <option value="WAITING_FOR_INFRASTRUCTURE">WAITING FOR INFRASTRUCTURE</option>
                                <option value="WAITING_FOR_APPROVAL">WAITING FOR APPROVAL</option>
                              </optgroup>
                              <optgroup label="BLOCKED" className="bg-slate-950">
                                <option value="BLOCKED_DEPENDENCY">BLOCKED DEPENDENCY</option>
                                <option value="BLOCKED_INFRASTRUCTURE">BLOCKED INFRASTRUCTURE</option>
                                <option value="BLOCKED_ACCESS">BLOCKED ACCESS</option>
                              </optgroup>
                              <optgroup label="COORDINATION" className="bg-slate-950">
                                <option value="CLIENT_VERIFICATION">CLIENT VERIFICATION</option>
                                <option value="RELEASE_WINDOW_PENDING">RELEASE WINDOW PENDING</option>
                                <option value="INTERNAL_REVIEW">INTERNAL REVIEW</option>
                              </optgroup>
                            </select>
                          </div>
                          
                          {isBlocked && (
                            <button
                              onClick={() => setSelectedUnblockTask(t)}
                              className="px-3 py-2 rounded-lg text-[10px] font-mono-pm uppercase tracking-wider bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all cursor-pointer self-end"
                            >
                              Unblock Request
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Icon name="check_circle" size={36} style={{ color: '#34d399', opacity: 0.5 }} />
                    <p className="text-sm font-medium text-slate-400">
                      All assigned work successfully delivered. Outstanding job!
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Neighboring Execution Dependencies */}
            <div className="glass-panel rounded-xl p-6 bg-slate-900/40 border border-slate-800">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-slate-200">
                  Neighboring Dependencies Map
                </h2>
                <span className="font-mono-pm text-[10px] uppercase text-slate-400">
                  LIMITED VISIBILITY (Upstream & Downstream)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Upstream Dependencies */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider font-mono-pm text-indigo-400">
                    ▲ Upstream (What I Wait For)
                  </h3>
                  {devDependencies.upstream.length > 0 ? (
                    devDependencies.upstream.map(({ dep, task }: any) => (
                      <div key={dep.task_id + '-' + dep.depends_on_task_id} className="p-3 rounded-lg border bg-slate-950/60 border-slate-800 flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-slate-200">{task.name}</span>
                        <div className="flex items-center justify-between text-[10px] font-mono-pm text-slate-400">
                          <span>STATUS: <strong className="text-indigo-400">{task.status?.toUpperCase()}</strong></span>
                          <span>ASSIGNEE: <strong>{task.assignee_id ? (userMap[task.assignee_id]?.full_name?.split(' ')[0] || 'Assigned') : 'Unassigned'}</strong></span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs py-4 text-center font-mono-pm text-slate-500">
                      No active upstream blocks.
                    </p>
                  )}
                </div>

                {/* Downstream Dependents */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider font-mono-pm text-amber-400">
                    ▼ Downstream (Who Waits For Me)
                  </h3>
                  {devDependencies.downstream.length > 0 ? (
                    devDependencies.downstream.map(({ dep, task }: any) => (
                      <div key={dep.task_id + '-' + dep.depends_on_task_id} className="p-3 rounded-lg border bg-slate-950/60 border-slate-800 flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-slate-200">{task.name}</span>
                        <div className="flex items-center justify-between text-[10px] font-mono-pm text-slate-400">
                          <span>STATUS: <strong className="text-red-400">BLOCKED</strong></span>
                          <span>ASSIGNEE: <strong>{task.assignee_id ? (userMap[task.assignee_id]?.full_name?.split(' ')[0] || 'Assigned') : 'Unassigned'}</strong></span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs py-4 text-center font-mono-pm text-slate-500">
                      No developers waiting on your tasks.
                    </p>
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
                  <button onClick={() => setSelectedUnblockTask(null)} className="text-red-400 hover:text-white transition-colors cursor-pointer text-xs font-mono-pm uppercase">
                    Close
                  </button>
                </div>
                
                <div className="text-xs">
                  <p className="font-semibold text-slate-200 mb-1">TASK:</p>
                  <p className="text-slate-400">{selectedUnblockTask.name}</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono-pm text-[9px] uppercase tracking-wider text-slate-400">
                    Unblock Request / Coordination Notes
                  </label>
                  <textarea
                    value={unblockReason}
                    onChange={(e) => setUnblockReason(e.target.value)}
                    placeholder="Enter what resources, data, or approvals are needed to clear this block..."
                    className="p-3 rounded-lg text-xs font-mono-pm min-h-[90px] border transition-colors outline-none bg-slate-950 text-slate-200 border-slate-800"
                  />
                </div>

                <button
                  onClick={() => handleSendUnblockRequest(selectedUnblockTask.id, unblockReason)}
                  disabled={!unblockReason.trim()}
                  className="w-full py-2 rounded-lg text-xs font-mono-pm uppercase tracking-widest bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50 transition-all cursor-pointer text-center"
                >
                  Send Unblock Signal
                </button>
              </div>
            ) : (
              <div className="glass-panel rounded-xl p-5 bg-slate-900/40 border border-slate-800 flex flex-col items-center justify-center text-center min-h-[160px] gap-2">
                <Icon name="lock" size={24} style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.4 }} />
                <h3 className="text-xs font-semibold uppercase tracking-wider font-mono-pm text-slate-400">
                  Blocker Coordinator
                </h3>
                <p className="text-[11px] text-slate-500">
                  Select "Unblock Request" on any blocked task to notify project managers.
                </p>
              </div>
            )}

            {/* Required Approvals & Coordination */}
            <div className="glass-panel rounded-xl p-5 bg-slate-900/40 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 border-b pb-3 border-slate-800">
                <Icon name="check_circle" size={16} style={{ color: 'var(--pm-primary)' }} />
                <h3 className="text-xs font-semibold uppercase tracking-widest font-mono-pm text-slate-200">
                  Approvals & waiting states
                </h3>
              </div>
              <div className="space-y-3">
                {devOpenTasks.some((t: any) => taskSubStates[t.id] === 'WAITING_FOR_APPROVAL' || taskSubStates[t.id] === 'INTERNAL_REVIEW' || taskSubStates[t.id] === 'CLIENT_VERIFICATION') ? (
                  devOpenTasks.filter((t: any) => taskSubStates[t.id] === 'WAITING_FOR_APPROVAL' || taskSubStates[t.id] === 'INTERNAL_REVIEW' || taskSubStates[t.id] === 'CLIENT_VERIFICATION').map((t: any) => (
                    <div key={t.id} className="p-3 rounded-lg border bg-slate-950/60 border-slate-800 flex flex-col gap-1.5 text-xs">
                      <span className="font-semibold text-slate-200">{t.name}</span>
                      <div className="flex items-center justify-between text-[10px] font-mono-pm text-slate-400">
                        <span className="text-amber-400 font-bold uppercase">{taskSubStates[t.id]?.replace(/_/g, ' ')}</span>
                        <span>EST: {t.estimated_hours}h</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] py-4 text-center font-mono-pm text-slate-500">
                    No tasks waiting for review or approval.
                  </p>
                )}
              </div>
            </div>

            {/* Deployment Coordination Countdown */}
            <div className="rounded-xl p-5 border bg-indigo-950/5 border-indigo-900/20 flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b pb-3 border-indigo-900/20">
                <Icon name="schedule" size={16} style={{ color: 'var(--pm-primary)' }} />
                <h3 className="text-xs font-semibold uppercase tracking-widest font-mono-pm text-indigo-400">
                  Release coordination
                </h3>
              </div>

              <div className="flex flex-col items-center justify-center py-2 text-center">
                <span className="font-mono-pm text-[9px] uppercase tracking-[0.2em] text-indigo-400 mb-1">
                  NEXT WEEKLY PROD ROLLOUT
                </span>
                <span className="text-2xl font-bold tracking-wider font-mono-pm text-white">
                  {releaseCountdown || '00h 00m 00s'}
                </span>
                <span className="text-[10px] mt-1 text-slate-500">
                  Friday 18:00 UTC Rollout Cadence
                </span>
              </div>

              {deploymentTasks.length > 0 && (
                <div className="space-y-2 mt-2">
                  <span className="font-mono-pm text-[9px] uppercase tracking-wider block text-slate-400">
                    ACTIVE INTEGRATIONS ({deploymentTasks.length})
                  </span>
                  {deploymentTasks.map((dt: any) => (
                    <div key={dt.id} className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
                      <span className="truncate max-w-[150px]">{dt.name}</span>
                      <span className="font-mono-pm text-[10px] text-indigo-300 uppercase">{taskSubStates[dt.id]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16 font-geist" style={{ color: 'var(--pm-on-surface)' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--pm-on-surface)' }}>
            {isDeveloper 
              ? (profile?.full_name ? `${profile.full_name.split(' ')[0]}'s Execution Console` : 'My Execution Console')
              : (profile?.full_name ? `${profile.full_name.split(' ')[0]}'s Command Center` : 'Executive Overview')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            {isDeveloper 
              ? 'Tactical task delivery, active blockers, and personal velocity cadence.'
              : 'Portfolio intelligence and operational status across all active initiatives.'}
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border"
          style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 operational-pulse" style={{ boxShadow: '0 0 8px rgba(52,211,153,0.5)' }} />
          <span className="font-mono-pm text-xs uppercase tracking-widest" style={{ color: 'var(--pm-on-surface-variant)' }}>
            SYSTEM OPERATIONAL
          </span>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {kpis.map((kpi, i) => (
          <div key={i} className="pm-card p-5 relative overflow-hidden group">
            {/* Ambient glow */}
            <div className="absolute -right-3 -top-3 w-16 h-16 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: kpi.color }} />
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${kpi.color}18`, border: `1px solid ${kpi.color}30` }}>
                <Icon name={kpi.icon} size={20} style={{ color: kpi.color }} />
              </div>
              <span className="font-mono-pm text-[9px] uppercase tracking-[0.2em]"
                style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>
                LIVE
              </span>
            </div>
            <div className="text-3xl font-bold tracking-tight" style={{ color: kpi.color }}>
              {kpi.value}
            </div>
            <div className="text-[11px] font-semibold mt-1 mb-0.5" style={{ color: 'var(--pm-on-surface)' }}>
              {kpi.label}
            </div>
            <div className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>
              {kpi.sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── Velocity + Intelligence ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Velocity Trend Chart */}
        <div className="glass-panel rounded-xl p-6 lg:col-span-8 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--pm-on-surface)' }}>
                {isDeveloper ? 'My Task Velocity Trends' : 'Velocity Trends'}
              </h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--pm-on-surface-variant)' }}>
                {isDeveloper 
                  ? `Personal delivery throughput and task cadence — ${chartTasks.length} tasks completed`
                  : `System-wide throughput and delivery cadence — ${totalTasks} tasks tracked`}
              </p>
            </div>
            <div className="flex gap-2">
              {['7D', '15D', '30D'].map((p) => (
                <button key={p} 
                  onClick={() => setVelocityPeriod(p)}
                  className="px-3 py-1 rounded font-mono-pm text-xs transition-all cursor-pointer"
                  style={velocityPeriod === p
                    ? { background: 'var(--pm-surface-highest)', color: 'var(--pm-on-surface)' }
                    : { color: 'var(--pm-on-surface-variant)', border: '1px solid var(--pm-outline-variant)' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 relative min-h-[160px]">
            <svg className="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="velGrad" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#c0c1ff', stopOpacity: 0.2 }} />
                  <stop offset="100%" style={{ stopColor: '#c0c1ff', stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              {[0.25, 0.5, 0.75].map((f, i) => (
                <line key={i} x1="0" x2="800" y1={200 * f} y2={200 * f}
                  stroke="rgba(70,69,84,0.15)" strokeWidth="1" />
              ))}
              <path className="pulse-line" d={svgPath.line} fill="none" stroke="#c0c1ff" strokeWidth="2.5" strokeLinecap="round" />
              <path d={svgPath.fill} fill="url(#velGrad)" />
              {/* Vertex Nodes */}
              {svgPath.pts.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r="3.5"
                  fill="#c0c1ff"
                  stroke="var(--pm-bg)"
                  strokeWidth="1.5"
                />
              ))}
            </svg>
            {/* Y axis labels */}
            <div className="absolute left-0 flex flex-col justify-between pointer-events-none" style={{ top: '15%', bottom: '5%' }}>
              {['100%', '75%', '50%', '25%', '0%'].map((l, i) => (
                <span key={l} className="font-mono-pm text-[9px]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.4 }}>
                  {i === 0 ? Math.round(svgPath.maxVal) : Math.round(svgPath.maxVal * (1 - i * 0.25))}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center mt-4 pt-4 border-t" style={{ borderColor: 'rgba(70,69,84,0.2)' }}>
            <div className="flex items-center gap-3">
              <span className="w-3 h-[2px] rounded" style={{ background: 'var(--pm-primary)' }} />
              <span className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-on-surface-variant)' }}>VELOCITY INDEX</span>
            </div>
            <span className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-primary)' }}>
              {deliveryConfidence !== undefined ? `${deliveryConfidence}% CONFIDENCE BAND` : 'CONFIDENCE BAND'}
            </span>
          </div>
        </div>

        {/* Delivery Friction & Wait-Time Intelligence */}
        <div className="lg:col-span-4 rounded-xl p-6 flex flex-col"
          style={{ background: 'rgba(192,193,255,0.03)', border: '1px solid rgba(192,193,255,0.12)' }}>
          <div className="flex items-center gap-2 mb-5 border-b pb-3" style={{ borderColor: 'rgba(192,193,255,0.1)' }}>
            <Icon name="auto_awesome" size={20} style={{ color: 'var(--pm-primary)' }} />
            <h2 className="text-base font-semibold text-indigo-300">
              Friction & Wait-Time Analytics
            </h2>
          </div>
          
          <div className="space-y-5 flex-1">
            {/* Wait-Time Ratio Gauges */}
            <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800 text-center">
              <span className="font-mono-pm text-[9px] uppercase tracking-[0.2em] text-indigo-400 block mb-1">
                PORTFOLIO WAIT-TIME LATENCY
              </span>
              <div className="text-3xl font-bold tracking-tight text-white font-mono-pm">
                {globalFrictionSummary?.avgWaitTimeRatio ?? 0}%
              </div>
              <p className="text-[11px] mt-1.5 leading-relaxed text-slate-400">
                Initiatives spent {globalFrictionSummary?.avgWaitTimeRatio ?? 0}% of active delivery cycles stalled in waiting states or dependency bottlenecks.
              </p>
            </div>

            {/* 5 Friction Categories Scorebars */}
            <div className="space-y-3.5">
              <span className="font-mono-pm text-[9px] uppercase tracking-wider block text-slate-400">
                DELIVERY FRICTION CLASSIFIERS
              </span>
              {[
                { label: 'Blocker Recurrence', score: globalFrictionSummary?.globalFrictionCategories?.blockerRecurrence ?? 0, color: 'var(--pm-error)' },
                { label: 'Dependency Instability', score: globalFrictionSummary?.globalFrictionCategories?.dependencyInstability ?? 0, color: '#ff9800' },
                { label: 'Client Responsiveness', score: globalFrictionSummary?.globalFrictionCategories?.clientResponsiveness ?? 0, color: '#3f51b5' },
                { label: 'Coordination Overhead', score: globalFrictionSummary?.globalFrictionCategories?.coordinationOverhead ?? 0, color: '#e91e63' },
                { label: 'Infrastructure Reliability', score: globalFrictionSummary?.globalFrictionCategories?.infrastructureReliability ?? 0, color: 'var(--pm-primary)' },
              ].map((c, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">{c.label}</span>
                    <span className="font-mono-pm text-slate-400">{c.score}/100</span>
                  </div>
                  <div className="h-2 w-full rounded-full overflow-hidden bg-slate-950">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${c.score}%`, background: c.color }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Operational Continuity Rating */}
            <div className="p-3.5 rounded-lg bg-indigo-950/5 border border-indigo-900/10 flex items-center justify-between">
              <div>
                <span className="font-mono-pm text-[9px] uppercase tracking-widest text-indigo-400 block mb-0.5">
                  OPERATIONAL CONTINUITY
                </span>
                <span className="text-xs text-slate-400">Stable, non-switching cadence</span>
              </div>
              <span className="font-mono-pm text-base font-bold text-white">
                {globalFrictionSummary?.avgOperationalContinuity ?? 95}/100
              </span>
            </div>

          </div>

          <button 
            onClick={() => notify("Initiative calibration engine running.", "info")}
            className="mt-5 w-full py-2.5 rounded-lg text-xs font-mono-pm uppercase tracking-widest transition-all hover:bg-accent-primary hover:text-white active:scale-95 text-center bg-accent-primary/10 border border-accent-primary/20 text-accent-primary cursor-pointer"
          >
            Calibrate Simulation Models
          </button>
        </div>
      </div>

      {/* ── Lower Row: Activity + Milestones ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Audit Trail / Recent Activity */}
        <div className="glass-panel rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold" style={{ color: 'var(--pm-on-surface)' }}>
              {isDeveloper ? 'My Recent Activity' : 'Audit Trail & Activity'}
            </h2>
            <span className="font-mono-pm text-[10px] uppercase" style={{ color: 'var(--pm-on-surface-variant)' }}>
              LIVE STREAM
            </span>
          </div>
          <div className="space-y-4 pm-scrollbar overflow-y-auto max-h-56 pr-1">
            {recentActivity.length > 0 ? recentActivity.map((ev, i) => (
              <div key={ev.id} className="flex gap-4 items-start relative pl-4"
                style={{ borderLeft: '1px solid rgba(70,69,84,0.3)' }}>
                <div className="absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full"
                  style={{ background: i === 0 ? 'var(--pm-primary)' : 'var(--pm-outline-variant)', boxShadow: i === 0 ? '0 0 8px rgba(192,193,255,0.6)' : 'none' }} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: 'var(--pm-on-surface)' }}>{ev.title}</span>
                    <span className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-on-surface-variant)' }}>{ev.time} UTC</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-on-surface-variant)' }}>
                      by <span className="font-semibold text-[11px]" style={{ color: 'var(--pm-on-surface)' }}>{ev.actorName.split(' ')[0]}</span>
                    </span>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span className="font-mono-pm text-[10px] uppercase"
                      style={{ color: ev.status === 'done' ? '#34d399' : ev.status === 'in_progress' ? 'var(--pm-primary)' : 'var(--pm-on-surface-variant)' }}>
                      {ev.status?.replace('_', ' ')}
                    </span>
                    {ev.risk === 'high' && (
                      <span className="pm-badge-error" style={{ fontSize: 9 }}>HIGH RISK</span>
                    )}
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-sm text-center py-6" style={{ color: 'var(--pm-on-surface-variant)' }}>
                No recent operational activity.
              </p>
            )}
          </div>
          {!isDeveloper && (
            <button 
              onClick={() => {
                window.history.pushState(null, '', '/workspace/decisions');
                window.dispatchEvent(new Event('popstate'));
              }}
              className="mt-4 font-mono-pm text-[10px] uppercase tracking-widest transition-colors hover:opacity-100"
              style={{ color: 'var(--pm-primary)', opacity: 0.7 }}>
              View full decision log →
            </button>
          )}
        </div>

        {/* Upcoming Deadlines / Milestones */}
        <div className="glass-panel rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold" style={{ color: 'var(--pm-on-surface)' }}>
              {isDeveloper ? 'My Upcoming Deadlines' : 'Upcoming Milestones'}
            </h2>
            <Icon name="calendar_today" size={18} style={{ color: 'var(--pm-on-surface-variant)' }} />
          </div>
          <div className="space-y-3">
            {upcomingDeadlines.length > 0 ? upcomingDeadlines.map((item: any, i) => {
              const deadlineDate = item.deadline || item.due_date;
              const daysLeft = Math.ceil((new Date(deadlineDate).getTime() - Date.now()) / 86400000);
              const isUrgent = daysLeft <= 7;
              return (
                <div key={item.id} className="flex items-center justify-between p-4 rounded-xl transition-all"
                  style={{ background: 'var(--pm-surface-high)', border: `1px solid ${isUrgent ? 'rgba(255,180,171,0.2)' : 'rgba(70,69,84,0.3)'}` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ background: isUrgent ? 'rgba(255,180,171,0.1)' : 'rgba(192,193,255,0.08)', border: `1px solid ${isUrgent ? 'rgba(255,180,171,0.2)' : 'rgba(192,193,255,0.15)'}` }}>
                      <Icon name="flag" size={16} style={{ color: isUrgent ? 'var(--pm-error)' : 'var(--pm-primary)' }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--pm-on-surface)' }}>{item.name}</p>
                      <p className="font-mono-pm text-[10px] mt-0.5 uppercase"
                        style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>
                        {isDeveloper ? 'Assigned Task' : `${item.template || 'Standard'} Pipeline`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono-pm text-[13px] font-medium" style={{ color: isUrgent ? 'var(--pm-error)' : 'var(--pm-on-surface)' }}>
                      {new Date(deadlineDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="font-mono-pm text-[10px] mt-0.5" style={{ color: isUrgent ? 'var(--pm-error)' : 'var(--pm-on-surface-variant)', opacity: 0.8 }}>
                      {daysLeft > 0 ? `${daysLeft}d remaining` : 'OVERDUE'}
                    </p>
                  </div>
                </div>
              );
            }) : (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Icon name="check_circle" size={32} style={{ color: '#34d399', opacity: 0.5 }} />
                <p className="text-sm" style={{ color: 'var(--pm-on-surface-variant)' }}>
                  {isDeveloper ? 'No upcoming tasks deadlines.' : 'No critical deadlines approaching.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Status KPI Bar ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isDeveloper ? (
          [
            { label: 'My Done Weight', value: `${devCompletedWeight}h`, unit: 'allotted', trend: 'Completed', trendUp: true },
            { label: 'Workload Pressure', value: `${devTotalHrs}h`, unit: 'active', trend: devOverloadStatus ? 'Imbalanced' : 'Healthy', trendUp: !devOverloadStatus },
            { label: 'Tasks Blocked', value: `${devBlockedTasks.length}`, unit: 'dependencies', trend: devBlockedTasks.length === 0 ? 'Nominal' : 'Action needed', trendUp: devBlockedTasks.length === 0 },
            {
              label: 'Personal Throughput',
              value: `${devOpenTasks.length + devCompletedTasks.length > 0 ? Math.round((devCompletedTasks.length / (devOpenTasks.length + devCompletedTasks.length)) * 100) : 0}%`,
              unit: 'completion',
              trend: 'Live Cadence',
              trendUp: true
            },
          ].map((item, i) => (
            <div key={i} className="glass-panel rounded-lg p-4 flex flex-col gap-2">
              <span className="font-mono-pm text-[9px] uppercase tracking-widest"
                style={{ color: 'var(--pm-on-surface-variant)' }}>
                {item.label}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold" style={{ color: 'var(--pm-on-surface)' }}>{item.value}</span>
                {item.unit && <span className="font-mono-pm text-[11px]" style={{ color: 'var(--pm-on-surface-variant)' }}>{item.unit}</span>}
              </div>
              <span className="font-mono-pm text-[10px]"
                style={{ color: item.trendUp ? '#34d399' : 'var(--pm-tertiary)' }}>
                {item.trend}
              </span>
            </div>
          ))
        ) : (
          [
            { label: 'Portfolio Velocity', value: `${completedTasks.length * 8}`, unit: 'pts/sprint', trend: '+12%', trendUp: true },
            { label: 'Resource Burn', value: '68%', unit: 'nominal', trend: 'Stable', trendUp: true },
            { label: 'Risk Index', value: riskStatus, unit: '', trend: highRiskTasks === 0 ? 'Clear' : `${highRiskTasks} flagged`, trendUp: highRiskTasks === 0 },
            {
              label: 'Execution Health',
              value: deliveryConfidence !== undefined ? `${deliveryConfidence}%` : (
                <span className="inline-block w-8 h-5 bg-white/10 animate-pulse rounded" />
              ),
              unit: 'confidence',
              trend: completionRate > 50 ? 'On Track' : 'Review',
              trendUp: completionRate > 50
            },
          ].map((item, i) => (
            <div key={i} className="glass-panel rounded-lg p-4 flex flex-col gap-2">
              <span className="font-mono-pm text-[9px] uppercase tracking-widest"
                style={{ color: 'var(--pm-on-surface-variant)' }}>
                {item.label}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold" style={{ color: 'var(--pm-on-surface)' }}>{item.value}</span>
                {item.unit && <span className="font-mono-pm text-[11px]" style={{ color: 'var(--pm-on-surface-variant)' }}>{item.unit}</span>}
              </div>
              <span className="font-mono-pm text-[10px]"
                style={{ color: item.trendUp ? '#34d399' : 'var(--pm-tertiary)' }}>
                {item.trend}
              </span>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
