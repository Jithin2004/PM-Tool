import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Link2, Activity, User as UserIcon, ArrowRight } from 'lucide-react';
import { useOperationalData } from '../../../context/OperationalDataContext';
import { supabase } from '../../../lib/supabase';
import { reconstructProjectTimeline, type DeliveryTimeline } from '../../../core/execution/flowEngine';

export default function TimelineView({ tasks, projects, dependencies, users }: any) {
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(true);
  const [activeProjectTab, setActiveProjectTab] = useState<string>('');

  const { raw: { workspaceSettingsBlob } } = useOperationalData();

  const userMap = useMemo(() => {
    const map = new Map<string, any>();
    if (users && Array.isArray(users)) {
      users.forEach(u => map.set(u.id, u));
    }
    return map;
  }, [users]);

  useEffect(() => {
    let active = true;
    async function loadLogs() {
      if (!tasks || tasks.length === 0) {
        setHistoryLogs([]);
        setLoadingLogs(false);
        return;
      }
      setLoadingLogs(true);
      try {
        const taskIds = tasks.map((t: any) => t.id);
        const { data, error } = await supabase
          .from('task_history_logs')
          .select('*')
          .in('task_id', taskIds);
        
        if (active) {
          if (data && !error) {
            setHistoryLogs(data);
          } else {
            setHistoryLogs([]);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch task history logs:", err);
      } finally {
        if (active) {
          setLoadingLogs(false);
        }
      }
    }
    loadLogs();
    return () => {
      active = false;
    };
  }, [tasks]);

  const projectsWithTasks = useMemo(() => {
    return projects.filter((p: any) => tasks.some((t: any) => t.project_id === p.id));
  }, [projects, tasks]);

  useEffect(() => {
    if (projectsWithTasks.length > 0 && !activeProjectTab) {
      setActiveProjectTab(projectsWithTasks[0].id);
    }
  }, [projectsWithTasks, activeProjectTab]);

  const activeProject = useMemo(() => {
    return projectsWithTasks.find((p: any) => p.id === activeProjectTab) || projectsWithTasks[0];
  }, [projectsWithTasks, activeProjectTab]);

  const timeline: DeliveryTimeline | null = useMemo(() => {
    if (!activeProject || loadingLogs) return null;
    const projectTasks = tasks.filter((t: any) => t.project_id === activeProject.id);
    const projectDeps = dependencies.filter((d: any) => 
      projectTasks.some((t: any) => t.id === d.task_id) && 
      projectTasks.some((t: any) => t.id === d.depends_on_task_id)
    );
    const taskSubstates = (workspaceSettingsBlob?.task_substates as Record<string, string>) || {};
    const blockers = (workspaceSettingsBlob?.execution_blockers as any[]) || [];
    const decisions = (workspaceSettingsBlob?.operational_decisions as any[]) || [];
    const events = (workspaceSettingsBlob?.coordination_events as any[]) || [];

    return reconstructProjectTimeline(
      activeProject.id,
      activeProject.name,
      projectTasks,
      projectDeps,
      historyLogs,
      blockers,
      taskSubstates,
      decisions,
      events
    );
  }, [activeProject, tasks, dependencies, historyLogs, workspaceSettingsBlob, loadingLogs]);

  const { minTime, maxTime, totalDurationMs } = useMemo(() => {
    if (!timeline || timeline.flows.length === 0) {
      const now = Date.now();
      return { minTime: now - 7 * 86400000, maxTime: now + 7 * 86400000, totalDurationMs: 14 * 86400000 };
    }

    let min = Date.now();
    let max = Date.now();

    timeline.flows.forEach(flow => {
      flow.windows.forEach(w => {
        const start = new Date(w.start).getTime();
        if (start < min) min = start;
        if (w.end) {
          const end = new Date(w.end).getTime();
          if (end > max) max = end;
        }
      });
      flow.waits.forEach(w => {
        const start = new Date(w.start).getTime();
        if (start < min) min = start;
        if (w.end) {
          const end = new Date(w.end).getTime();
          if (end > max) max = end;
        }
      });
      flow.checkpoints.forEach(cp => {
        const t = new Date(cp.timestamp).getTime();
        if (t < min) min = t;
        if (t > max) max = t;
      });
    });

    const span = max - min;
    const buffer = span > 0 ? span * 0.05 : 24 * 3600000;
    const finalMin = min - buffer;
    const finalMax = max + buffer;

    return { minTime: finalMin, maxTime: finalMax, totalDurationMs: finalMax - finalMin };
  }, [timeline]);

  const getPercentage = useCallback((isoStr: string) => {
    const timeMs = new Date(isoStr).getTime();
    if (timeMs <= minTime) return 0;
    if (timeMs >= maxTime) return 100;
    return ((timeMs - minTime) / totalDurationMs) * 100;
  }, [minTime, maxTime, totalDurationMs]);

  const avgContinuity = useMemo(() => {
    if (!timeline || timeline.flows.length === 0) return 100;
    const sum = timeline.flows.reduce((s, f) => s + f.continuityScore, 0);
    return Math.round(sum / timeline.flows.length);
  }, [timeline]);

  const continuityGrade = useMemo(() => {
    if (avgContinuity >= 85) return { text: 'FLUID CONTINUITY', color: 'text-signal-safe border-signal-safe/20 bg-signal-safe/5' };
    if (avgContinuity >= 60) return { text: 'STABLE PROGRESS', color: 'text-signal-warning border-signal-warning/20 bg-signal-warning/5' };
    return { text: 'CRITICAL FRICTION', color: 'text-signal-critical border-signal-critical/20 bg-signal-critical/5' };
  }, [avgContinuity]);

  const waitPercentage = useMemo(() => {
    if (!timeline) return 0;
    const total = timeline.totalWaitHours + timeline.totalActiveHours;
    return total > 0 ? Math.round((timeline.totalWaitHours / total) * 100) : 0;
  }, [timeline]);

  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; hours: number }> = {
      client: { count: 0, hours: 0 },
      infrastructure: { count: 0, hours: 0 },
      approval: { count: 0, hours: 0 },
      vendor: { count: 0, hours: 0 },
      access: { count: 0, hours: 0 },
      dependency: { count: 0, hours: 0 }
    };

    if (timeline) {
      timeline.flows.forEach(flow => {
        flow.waits.forEach(wait => {
          if (stats[wait.category]) {
            stats[wait.category].count++;
            stats[wait.category].hours += wait.durationHours;
          }
        });
      });
    }

    return stats;
  }, [timeline]);

  if (loadingLogs) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-text-tertiary font-medium">Reconstructing Temporal Timeline...</span>
        </div>
      </div>
    );
  }

  if (!activeProject || !timeline || timeline.flows.length === 0) {
    return (
      <div className="flex flex-col h-full">
        {projectsWithTasks.length > 1 && (
          <div className="flex items-center gap-2 mb-6 border-b border-border pb-2 overflow-x-auto scrollbar-none">
            {projectsWithTasks.map((p: any) => (
              <button
                key={p.id}
                onClick={() => setActiveProjectTab(p.id)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all border ${
                  activeProjectTab === p.id 
                    ? 'bg-accent-primary/10 border-accent-primary/20 text-accent-primary' 
                    : 'bg-transparent border-transparent text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-col items-center justify-center h-96 border border-dashed border-border rounded-xl bg-surface-2 p-8">
          <Activity className="w-12 h-12 text-text-quaternary mb-3 animate-pulse" />
          <h4 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-1">No Temporal Execution Data</h4>
          <p className="text-xs text-text-tertiary text-center max-w-sm">Activate task progression logs and roadblock trackers to visualize real delivery timelines.</p>
        </div>
      </div>
    );
  }

  const midTimeStr = new Date(minTime + totalDurationMs / 2).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const startStr = new Date(minTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endStr = new Date(maxTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <>
      <div className="block md:hidden bg-surface border border-border-subtle rounded-xl p-8 text-center mt-4">
        <Activity className="w-12 h-12 text-accent-primary mx-auto mb-4 opacity-80" />
        <h2 className="text-lg font-bold text-text-primary mb-2">Desktop View Required</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          The Timeline View requires a larger viewport for complex visualizations. Please access this view on a tablet or desktop device.
        </p>
      </div>
      <div className="hidden md:flex flex-col gap-6 h-full overflow-y-auto pr-2 pb-10 scrollbar-thin">
      {/* Project selector */}
      {projectsWithTasks.length > 1 && (
        <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto scrollbar-none shrink-0">
          {projectsWithTasks.map((p: any) => (
            <button
              key={p.id}
              onClick={() => setActiveProjectTab(p.id)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all border ${
                activeProjectTab === p.id 
                  ? 'bg-accent-primary/10 border-accent-primary/20 text-accent-primary' 
                  : 'bg-transparent border-transparent text-text-tertiary hover:text-text-secondary'
            }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Continuity Card */}
        <div className="bg-surface-3/50 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Continuity Score</span>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${continuityGrade.color}`}>
              {continuityGrade.text}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-text-primary">{avgContinuity}</span>
            <span className="text-sm text-text-tertiary">/ 100</span>
          </div>
          <p className="text-[10px] text-text-quaternary mt-2">Weighted metric of roadblock frequency and wait-state ratio.</p>
        </div>

        {/* Operational Drift Card */}
        <div className="bg-surface-3/50 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Operational Drift</span>
            {timeline.driftDays > 0 ? (
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                timeline.driftDays > 5 ? 'text-signal-critical border-signal-critical/20 bg-signal-critical/5' : 'text-signal-warning border-signal-warning/20 bg-signal-warning/5'
              }`}>
                Drifting
              </span>
            ) : (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded border border-signal-safe/20 bg-signal-safe/5 text-signal-safe uppercase tracking-wider">
                On Track
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-text-primary">+{timeline.driftDays}</span>
            <span className="text-sm font-bold text-text-primary">Days</span>
          </div>
          <p className="text-[10px] text-text-quaternary mt-2">Actual active duration vs estimated days of progress.</p>
        </div>

        {/* Wait-State Latency Card */}
        <div className="bg-surface-3/50 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Wait-Time Latency</span>
            <span className="text-xs font-bold text-text-primary">{waitPercentage}% Ratio</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text-primary">{timeline.totalWaitHours}h</span>
            <span className="text-xs text-text-tertiary">Stalled / {timeline.totalActiveHours}h Active</span>
          </div>
          <div className="w-full h-1.5 bg-indigo-500 rounded-full overflow-hidden flex mt-2.5">
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${waitPercentage}%` }} />
          </div>
        </div>

        {/* Coordination Overhead */}
        <div className="bg-surface-3/50 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Overhead Density</span>
            <span className="text-xs font-bold text-text-primary">{timeline.flows.reduce((s, f) => s + f.interruptionCount, 0)} Interruptions</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-text-primary">
              {(timeline.flows.reduce((s, f) => s + f.interruptionCount, 0) / Math.max(1, timeline.flows.length)).toFixed(1)}
            </span>
            <span className="text-sm text-text-tertiary">Pauses / Task</span>
          </div>
          <p className="text-[10px] text-text-quaternary mt-2">Frequency of task suspension and external blocker handoffs.</p>
        </div>
      </div>

      {/* Timeline Console Chart */}
      <div className="bg-surface-3/50 backdrop-blur-md border border-border/50 rounded-2xl flex flex-col overflow-hidden shadow-sm">
        <div className="overflow-x-auto scrollbar-thin">
          <div className="min-w-[800px] relative">
            {/* Timeline Header (Ruler) */}
            <div className="sticky top-0 z-20 flex bg-surface/90 backdrop-blur-md border-b border-border">
              <div className="w-60 shrink-0 p-3 border-r border-border text-[10px] font-bold text-text-tertiary uppercase tracking-widest bg-surface/50">Execution Entity</div>
              <div className="flex-1 relative h-10 flex items-center px-4">
                <span className="absolute left-[5%] text-[9px] font-bold text-text-tertiary uppercase tracking-wider">{startStr}</span>
                <span className="absolute left-[50%] -translate-x-1/2 text-[9px] font-bold text-text-tertiary uppercase tracking-wider">{midTimeStr}</span>
                <span className="absolute right-[5%] text-[9px] font-bold text-text-tertiary uppercase tracking-wider">{endStr}</span>
              </div>
            </div>

            {/* Timeline Rows */}
            <div className="divide-y divide-border-subtle">
              {timeline.flows.map(flow => {
                const task = tasks.find((t: any) => t.id === flow.taskId);
                const assignee = task?.assignee_id ? userMap.get(task.assignee_id) : null;
                const taskSub = workspaceSettingsBlob?.task_substates?.[flow.taskId] || task?.status;

                return (
                  <div key={flow.taskId} className="flex hover:bg-[var(--pm-surface)]/[0.01] transition-colors items-center">
                    <div className="w-60 shrink-0 p-3 border-r border-border flex flex-col gap-1 min-w-[240px]">
                      <span className="text-[12px] font-bold text-text-primary truncate" title={flow.taskName}>{flow.taskName}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {assignee ? (
                          <div className="w-4 h-4 rounded-full bg-surface-3 border border-border overflow-hidden flex items-center justify-center shrink-0">
                            {assignee.avatar_url ? (
                              <img src={assignee.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[8px] font-bold text-text-secondary">{assignee.full_name?.[0] || assignee.email?.[0]}</span>
                            )}
                          </div>
                        ) : (
                          <UserIcon className="w-3.5 h-3.5 text-text-quaternary" />
                        )}
                        <span className="text-[10px] text-text-tertiary truncate">{assignee?.full_name || assignee?.email || 'Unassigned'}</span>
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border bg-surface-3 border-border text-text-secondary ml-auto shrink-0 tracking-tight">
                          {taskSub}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 relative h-14 flex items-center px-4 overflow-visible">
                      <div className="absolute inset-y-0 left-[50%] w-[1px] bg-border-subtle/50 border-dashed z-0" />
                      <div className="w-full h-4 bg-surface-3 rounded-full relative overflow-visible flex items-center z-10 border border-border/40">
                        {/* Windows */}
                        {flow.windows.map((win, wIdx) => {
                          const left = getPercentage(win.start);
                          const right = win.end ? getPercentage(win.end) : 100;
                          const width = Math.max(1, right - left);

                          return (
                            <div
                              key={`win-${wIdx}`}
                              className="absolute h-full bg-indigo-500/20 border-y border-indigo-500/35 flex items-center justify-center cursor-pointer group/win transition-all hover:bg-indigo-500/35"
                              style={{ left: `${left}%`, width: `${width}%` }}
                            >
                              <div className="absolute bottom-full mb-2 hidden group-hover/win:block z-35 w-48 bg-surface border border-border p-2 rounded-lg shadow-xl text-left">
                                <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Execution Window</p>
                                <p className="text-[11px] font-bold text-text-primary leading-tight">{flow.taskName}</p>
                                <div className="text-[9px] text-text-secondary mt-1 space-y-0.5 font-mono">
                                  <p>Start: {new Date(win.start).toLocaleString()}</p>
                                  <p>End: {win.end ? new Date(win.end).toLocaleString() : 'Ongoing'}</p>
                                  <p className="font-bold text-indigo-300">Duration: {win.durationHours}h</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Waits */}
                        {flow.waits.map((wait, wIdx) => {
                          const left = getPercentage(wait.start);
                          const right = wait.end ? getPercentage(wait.end) : 100;
                          const width = Math.max(1, right - left);
                          
                          const catConfig: any = {
                            client: 'bg-amber-500/30 border-amber-500/40 text-amber-200',
                            infrastructure: 'bg-purple-500/30 border-purple-500/40 text-purple-200',
                            approval: 'bg-sky-500/30 border-sky-500/40 text-sky-200',
                            vendor: 'bg-teal-500/30 border-teal-500/40 text-teal-200',
                            access: 'bg-rose-500/30 border-rose-500/40 text-rose-200',
                            dependency: 'bg-red-500/30 border-red-500/40 text-red-200'
                          };
                          const currentStyle = catConfig[wait.category] || catConfig.client;

                          return (
                            <div
                              key={`wait-${wIdx}`}
                              className={`absolute h-full flex items-center justify-center cursor-pointer group/wait border-y transition-all hover:brightness-110 ${currentStyle}`}
                              style={{ left: `${left}%`, width: `${width}%` }}
                            >
                              <div className="absolute bottom-full mb-2 hidden group-hover/wait:block z-35 w-52 bg-surface border border-border p-2.5 rounded-lg shadow-xl text-left">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">Wait State: {wait.category}</span>
                                </div>
                                <p className="text-[11px] font-bold text-text-primary leading-tight">{flow.taskName}</p>
                                <p className="text-[10px] text-text-secondary mt-1 bg-surface-3 p-1 rounded border border-border-subtle">{wait.reason}</p>
                                <div className="text-[9px] text-text-tertiary mt-2 space-y-0.5 font-mono">
                                  <p>Start: {new Date(wait.start).toLocaleString()}</p>
                                  <p>End: {wait.end ? new Date(wait.end).toLocaleString() : 'Ongoing'}</p>
                                  <p className="font-bold text-amber-300">Stalled Duration: {wait.durationHours}h</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Checkpoints */}
                        {flow.checkpoints.map((cp, cpIdx) => {
                          const left = getPercentage(cp.timestamp);
                          
                          let colorClass = 'bg-accent-primary';
                          if (cp.type === 'blocker_added') colorClass = 'bg-signal-critical';
                          if (cp.type === 'blocker_resolved') colorClass = 'bg-signal-safe';
                          if (cp.type === 'state_change') colorClass = 'bg-indigo-400';
                          if (cp.type === 'decision_made') colorClass = 'bg-[#c0c1ff]';
                          if (cp.type === 'coordination_sync') colorClass = 'bg-teal-400';
                          if (cp.type === 'escalation_logged') colorClass = 'bg-rose-400';
                          if (cp.type === 'intervention_triggered') colorClass = 'bg-purple-400';

                          return (
                            <div
                              key={`cp-${cpIdx}`}
                              className={`absolute w-2 h-2 rounded-full cursor-pointer group/cp border border-[var(--pm-border)] dark:border-white/50 -translate-x-1/2 z-20 hover:scale-125 transition-transform ${colorClass}`}
                              style={{ left: `${left}%` }}
                            >
                              <div className="absolute bottom-full mb-2 hidden group-hover/cp:block z-35 w-56 bg-surface border border-border p-2.5 rounded-lg shadow-xl text-left">
                                <span className="text-[8px] font-mono text-text-quaternary uppercase tracking-widest">{new Date(cp.timestamp).toLocaleString()}</span>
                                <p className="text-[10px] font-bold text-text-secondary uppercase mt-1">Event: {cp.type.replace('_', ' ')}</p>
                                <div className="text-[10px] text-text-primary mt-1.5 space-y-1">
                                  {cp.fieldName && (
                                    <p>Changed <span className="font-mono text-text-secondary">{cp.fieldName}</span>: '{cp.oldValue || 'None'}' → <span className="font-bold">'{cp.newValue}'</span></p>
                                  )}
                                  {cp.notes && (
                                    <p className="italic text-text-secondary bg-surface-3 p-1 rounded border border-border-subtle">"{cp.notes}"</p>
                                  )}
                                  <p className="text-[9px] font-bold text-text-tertiary pt-1 border-t border-border-subtle mt-1.5">Actor: {cp.actorName}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Dependency Cascades */}
      {timeline.propagations.length > 0 && (
        <div className="bg-surface-3/50 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-border pb-3">
            <Link2 className="w-4 h-4 text-signal-critical" />
            <h4 className="text-sm font-bold text-text-primary uppercase tracking-wider">Dependency Delay Cascade Network</h4>
          </div>
          <div className="space-y-3">
            {timeline.propagations.map((p, idx) => (
              <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-surface border border-border-subtle rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-signal-critical bg-signal-critical-bg border border-signal-critical/20 px-2 py-0.5 rounded">
                    +{p.delayDays}d Cascade
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
                    <span className="font-bold text-text-primary truncate max-w-[150px]">{p.upstreamTaskName}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-text-quaternary" />
                    <span className="text-text-tertiary truncate max-w-[150px]">{p.downstreamTaskName}</span>
                  </div>
                </div>
                <span className="text-[10px] text-text-quaternary mt-1 md:mt-0 font-bold uppercase tracking-wider">
                  Propagation Vector: {p.propagationPath.join(' → ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wait-States Breakdowns */}
      <div className="bg-surface-3/50 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 border-b border-border pb-3">
          <Activity className="w-4 h-4 text-accent-secondary" />
          <h4 className="text-sm font-bold text-text-primary uppercase tracking-wider">Wait-State Latency Intelligence</h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {Object.entries(categoryStats).map(([cat, stat]) => {
            const hasOverhead = stat.count > 0;
            return (
              <div key={cat} className={`border rounded-xl p-5 text-center transition-all shadow-sm hover:shadow-md ${
                hasOverhead ? 'bg-surface border-border/50' : 'bg-surface-3/30 border-border-subtle/50 opacity-40'
              }`}>
                <p className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest mb-1">{cat}</p>
                <p className="text-lg font-bold text-text-primary">{stat.hours.toFixed(1)}h</p>
                <p className="text-[9px] text-text-quaternary mt-1">{stat.count} pauses</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </>
  );
}
