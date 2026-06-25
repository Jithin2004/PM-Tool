import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { Activity, ArrowRight, Link2, Search, AlertTriangle, Crosshair, ChevronRight, ChevronDown } from 'lucide-react';
import { useWorkspace } from '../../../context/WorkspaceContext';
import { timelineSimulationEngine } from '../../../core/engines/timelineSimulationEngine';
import { criticalPathEngine } from '../../../core/engines/criticalPathEngine';
import { timelineBaselineService } from '../../../services/timelineBaselineService';
import { dependencyService } from '../../../services/dependencyService';
import { useAuth } from '../../../context/AuthContext';
import type { WorkspaceSettings } from '../../../types/workspace';

const defaultWorkspaceSettings: WorkspaceSettings = {
  businessType: 'Software',
  workingDays: [1, 2, 3, 4, 5],
  workStart: '09:00',
  workEnd: '17:00',
  lunchDuration: 1,
  productivityFactor: 1,
  saturdayRule: 'off',
  timezone: 'UTC',
  attendanceEnabled: false,
  payrollEnabled: false
};

export default function ExecutionTimelineView({ tasks, projects, dependencies: initialDeps, users }: any) {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();

  const [activeProjectTab, setActiveProjectTab] = useState<string>('');

  const [milestones, setMilestones] = useState<any[]>([]);
  const [epics, setEpics] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [deps, setDeps] = useState<any[]>([]);
  const [baselines, setBaselines] = useState<any[]>([]);
  const [activeBaseline, setActiveBaseline] = useState<any | null>(null);
  const [simulationProgress, setSimulationProgress] = useState<{ processed: number, total: number } | null>(null);

  const [loading, setLoading] = useState(true);

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const [showCriticalPath, setShowCriticalPath] = useState(false);

  // Drag state
  const [draggingTask, setDraggingTask] = useState<any>(null);
  const [dragOffsetDays, setDragOffsetDays] = useState(0);

  // Simulation Modal
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);

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

  useEffect(() => {
    async function loadHierarchy() {
      if (!activeProject || !workspace) return;
      setLoading(true);

      try {
        const [mRes, eRes, sRes, dRes, bRes] = await Promise.all([
          supabase.from('milestones').select('*').eq('project_id', activeProject.id),
          supabase.from('epics').select('*').eq('project_id', activeProject.id),
          supabase.from('stories').select('*').eq('project_id', activeProject.id),
          dependencyService.getDependencies(workspace.id).catch(() => []),
          timelineBaselineService.getBaselines(activeProject.id).catch(() => [])
        ]);

        if (mRes.data) setMilestones(mRes.data);
        if (eRes.data) setEpics(eRes.data);
        if (sRes.data) setStories(sRes.data);
        if (dRes) setDeps(dRes);
        if (bRes) setBaselines(bRes);
      } catch (e) {
        console.error("Failed to load hierarchy for Gantt chart:", e);
      } finally {
        setLoading(false);
      }
    }
    loadHierarchy();
  }, [activeProject, workspace]);

  const projectTasks = useMemo(() => tasks.filter((t: any) => t.project_id === activeProject?.id), [tasks, activeProject]);

  const criticalPath = useMemo(() => {
    if (!showCriticalPath) return new Map();
    return criticalPathEngine.calculateCriticalPath(projectTasks, deps);
  }, [showCriticalPath, projectTasks, deps]);

  const toggleNode = (id: string) => setExpandedNodes(p => ({ ...p, [id]: !p[id] }));

  // Date utilities
  const minDate = useMemo(() => {
    let min = new Date().getTime() - 7 * 86400000;
    projectTasks.forEach((t: any) => {
      if (t.start_date) {
        const d = new Date(t.start_date).getTime();
        if (d < min) min = d;
      }
    });
    return min - 3 * 86400000;
  }, [projectTasks]);

  const maxDate = useMemo(() => {
    let max = new Date().getTime() + 14 * 86400000;
    projectTasks.forEach((t: any) => {
      if (t.deadline || t.predicted_completion) {
        const d = new Date(t.deadline || t.predicted_completion).getTime();
        if (d > max) max = d;
      }
    });
    return max + 3 * 86400000;
  }, [projectTasks]);

  const totalDurationMs = maxDate - minDate;

  const getPercentage = useCallback((isoStr: string | null, fallbackMs: number) => {
    if (!isoStr) {
      return ((fallbackMs - minDate) / totalDurationMs) * 100;
    }
    const timeMs = new Date(isoStr).getTime();
    if (timeMs <= minDate) return 0;
    if (timeMs >= maxDate) return 100;
    return ((timeMs - minDate) / totalDurationMs) * 100;
  }, [minDate, maxDate, totalDurationMs]);

  // Dragging logic
  const handleDragStart = (e: React.DragEvent, task: any) => {
    setDraggingTask(task);
    setDragOffsetDays(0);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  };

  const handleDrag = (e: React.DragEvent) => {
    // Advanced UI drag logic would calculate X offset to days.
    // For this prototype, we'll simulate a 5 day shift if dropped in a certain zone, 
    // or we just bind a "simulate delay" button to demonstrate the engine.
  };

  const handleDragEnd = async (e: React.DragEvent) => {
    if (!draggingTask) return;

    // Simulate finding a +5 day drag
    const shiftDays = 5;
    setIsSimulating(true);

    try {
      // Create mock payload for engine
      const input = {
        workspaceId: workspace!.id,
        triggerEntityId: draggingTask.id,
        triggerEntityType: 'task' as const,
        triggerAction: 'rescheduled' as const,
        tasks: projectTasks,
        milestones: milestones,
        dependencies: deps,
        calendarEvents: [], // Mock
        workspaceSettings: defaultWorkspaceSettings
      };

      const result = await timelineSimulationEngine.simulateDateChange(input);
      setSimulationResult({
        task: draggingTask,
        shiftDays,
        impact: result
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
      setDraggingTask(null);
    }
  };

  const applySimulation = async () => {
    if (!simulationResult) return;
    try {
      const input = {
        workspaceId: workspace!.id,
        triggerEntityId: simulationResult.task.id,
        triggerEntityType: 'task' as const,
        triggerAction: 'rescheduled' as const,
        tasks: projectTasks,
        dependencies: deps,
        calendarEvents: [],
        workspaceSettings: defaultWorkspaceSettings,
        actorId: profile?.id
      };
      await timelineSimulationEngine.applyTimelineChange(input, simulationResult.impact, (processed, total) => {
        setSimulationProgress({ processed, total });
      });
      setSimulationResult(null);
      setSimulationProgress(null);
      // Data will refresh via OperationalDataContext sockets
    } catch (err) {
      console.error(err);
      setSimulationProgress(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Activity className="animate-pulse text-accent-primary" /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-surface relative">
      {simulationProgress && (
        <div className="absolute inset-0 z-50 bg-surface/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-surface-elevated p-6 rounded-xl border border-border shadow-2xl flex flex-col items-center gap-4">
            <Activity className="w-8 h-8 text-accent-primary animate-pulse" />
            <div className="text-center">
              <h3 className="text-sm font-bold text-text-primary">Updating project timeline...</h3>
              <p className="text-xs text-text-secondary mt-1">{simulationProgress.processed} / {simulationProgress.total} updates processed</p>
            </div>
            <div className="w-48 h-2 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-primary transition-all duration-200"
                style={{ width: `${(simulationProgress.processed / simulationProgress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
      {/* Header Controls */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          {projectsWithTasks.map((p: any) => (
            <button
              key={p.id}
              onClick={() => setActiveProjectTab(p.id)}
              className={`px-3 py-1.5 text-xs font-bold uppercase rounded ${activeProjectTab === p.id ? 'bg-accent-primary/10 text-accent-primary' : 'text-text-tertiary hover:bg-surface-3'}`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-bold text-text-secondary cursor-pointer">
            <input type="checkbox" checked={showCriticalPath} onChange={e => setShowCriticalPath(e.target.checked)} className="rounded text-accent-primary focus:ring-accent-primary bg-surface border-border" />
            <Crosshair className="w-3.5 h-3.5" /> Show Critical Path
          </label>
          <div className="flex items-center gap-2 text-xs font-bold text-text-secondary">
            <Link2 className="w-3.5 h-3.5" /> Baseline:
            <select
              className="bg-surface-2 border border-border rounded px-2 py-1 outline-none focus:border-accent-primary"
              value={activeBaseline?.id || ''}
              onChange={e => setActiveBaseline(baselines.find(b => b.id === e.target.value) || null)}
            >
              <option value="">Current Reality</option>
              {baselines.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Gantt Area */}
      <div className="flex-1 overflow-auto relative flex scrollbar-thin">
        {/* Left Tree Pane */}
        <div className="w-64 shrink-0 border-r border-border bg-surface-2 flex flex-col z-20 sticky left-0">
          <div className="h-10 border-b border-border bg-surface-3 flex items-center px-4 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
            Execution Entity
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1 scrollbar-none">
            {/* Tree Render - Flat for prototype, but indented */}
            <div className="text-xs font-bold text-text-primary flex items-center gap-1 p-1 bg-surface rounded"><ChevronDown className="w-3.5 h-3.5" /> {activeProject?.name}</div>

            {milestones.map(m => (
              <div key={m.id} className="ml-2">
                <div className="text-[11px] font-bold text-text-secondary flex items-center gap-1 p-1 hover:bg-surface-3 rounded cursor-pointer" onClick={() => toggleNode(m.id)}>
                  {expandedNodes[m.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />} {m.name}
                </div>
                {expandedNodes[m.id] && projectTasks.filter((t: any) => t.milestone_id === m.id).map((t: any) => (
                  <div key={t.id} className="ml-4 p-1 flex items-center justify-between group hover:bg-surface-3 rounded">
                    <span className="text-[10px] text-text-primary truncate">{t.name}</span>
                    <span className={`text-[8px] px-1 py-0.5 rounded font-bold uppercase ${criticalPath.get(t.id)?.isCritical ? 'bg-signal-critical/20 text-signal-critical' : 'bg-surface-2 text-text-tertiary'}`}>
                      {criticalPath.get(t.id)?.isCritical ? 'CRITICAL' : t.status}
                    </span>
                  </div>
                ))}
              </div>
            ))}

            {/* Orphan tasks */}
            <div className="ml-2 text-[11px] font-bold text-text-secondary mt-4 mb-1">Unassigned Tasks</div>
            {projectTasks.filter((t: any) => !t.milestone_id).map((t: any) => (
              <div key={t.id} className="ml-4 p-1 flex items-center justify-between group hover:bg-surface-3 rounded">
                <span className="text-[10px] text-text-primary truncate">{t.name}</span>
                <span className={`text-[8px] px-1 py-0.5 rounded font-bold uppercase ${criticalPath.get(t.id)?.isCritical ? 'bg-signal-critical/20 text-signal-critical' : 'bg-surface-2 text-text-tertiary'}`}>
                  {criticalPath.get(t.id)?.isCritical ? 'CRITICAL' : t.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Timeline Pane */}
        <div className="min-w-[800px] flex-1 relative bg-[var(--pm-surface)]/50">
          {/* Header Axis */}
          <div className="h-10 border-b border-border sticky top-0 bg-surface/90 backdrop-blur z-10 flex items-center relative">
            <div className="absolute left-[5%] text-[9px] font-bold text-text-tertiary">{new Date(minDate).toLocaleDateString()}</div>
            <div className="absolute left-[50%] -translate-x-1/2 text-[9px] font-bold text-text-tertiary">{new Date(minDate + totalDurationMs / 2).toLocaleDateString()}</div>
            <div className="absolute right-[5%] text-[9px] font-bold text-text-tertiary">{new Date(maxDate).toLocaleDateString()}</div>
          </div>

          {/* Grid Lines */}
          <div className="absolute inset-0 top-10 pointer-events-none flex opacity-20">
            <div className="flex-1 border-r border-dashed border-border-subtle h-full" />
            <div className="flex-1 border-r border-dashed border-border-subtle h-full" />
            <div className="flex-1 border-r border-dashed border-border-subtle h-full" />
            <div className="flex-1 border-r border-dashed border-border-subtle h-full" />
          </div>

          {/* Timeline Bars */}
          <div className="p-2 space-y-1 relative mt-1">
            <div className="h-6" /> {/* Project spacer */}

            {milestones.map(m => (
              <React.Fragment key={m.id}>
                <div className="h-6 w-full relative">
                  {/* Milestone Bar (Not rendered perfectly due to lack of strict date rollup in this stub, mock representation) */}
                  <div className="absolute h-2 top-2 bg-text-tertiary rounded-full shadow" style={{ left: '20%', width: '50%' }} />
                </div>

                {expandedNodes[m.id] && projectTasks.filter((t: any) => t.milestone_id === m.id).map((t: any) => {
                  const left = getPercentage(t.start_date, minDate + 86400000);
                  const right = getPercentage(t.deadline || t.predicted_completion, minDate + 86400000 * 5);
                  const width = Math.max(2, right - left);
                  const isCrit = criticalPath.get(t.id)?.isCritical;

                  return (
                    <div key={t.id} className="h-6 w-full relative group">
                      <div
                        draggable
                        onDragStart={e => handleDragStart(e, t)}
                        onDragEnd={handleDragEnd}
                        className={`absolute h-4 top-1 rounded cursor-grab active:cursor-grabbing border ${isCrit ? 'bg-signal-critical/80 border-signal-critical shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-accent-primary/80 border-accent-primary hover:brightness-110'}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      >
                        <div className="absolute top-1/2 -translate-y-1/2 -left-3 w-2 h-2 rounded-full bg-white border border-border opacity-0 group-hover:opacity-100 transition-opacity" title="Drag to connect dependency" />
                        <div className="absolute top-1/2 -translate-y-1/2 -right-3 w-2 h-2 rounded-full bg-white border border-border opacity-0 group-hover:opacity-100 transition-opacity cursor-ew-resize" title="Drag to adjust duration" />
                      </div>

                      {/* Baseline Ghost */}
                      {activeBaseline && activeBaseline.snapshot[t.id] && (
                        <div
                          className="absolute h-4 top-1 rounded border border-dashed border-text-tertiary bg-transparent opacity-50 pointer-events-none"
                          style={{
                            left: `${getPercentage(activeBaseline.snapshot[t.id].start_date, minDate)}%`,
                            width: `${Math.max(2, getPercentage(activeBaseline.snapshot[t.id].deadline, minDate + 86400000) - getPercentage(activeBaseline.snapshot[t.id].start_date, minDate))}%`
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}

            {/* Unassigned Tasks */}
            <div className="h-8" />
            {projectTasks.filter((t: any) => !t.milestone_id).map((t: any) => {
              const left = getPercentage(t.start_date, minDate + 86400000);
              const right = getPercentage(t.deadline || t.predicted_completion, minDate + 86400000 * 5);
              const width = Math.max(2, right - left);
              const isCrit = criticalPath.get(t.id)?.isCritical;

              return (
                <div key={t.id} className="h-6 w-full relative group">
                  <div
                    draggable
                    onDragStart={e => handleDragStart(e, t)}
                    onDragEnd={handleDragEnd}
                    className={`absolute h-4 top-1 rounded cursor-grab active:cursor-grabbing border ${isCrit ? 'bg-signal-critical/80 border-signal-critical shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-accent-primary/80 border-accent-primary hover:brightness-110'}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Impact Confirmation Modal */}
      {simulationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-signal-warning mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-text-primary">Timeline Impact Detected</h3>
            </div>

            <p className="text-sm text-text-secondary mb-6 leading-relaxed">
              Moving <span className="font-bold text-text-primary">"{simulationResult.task.name}"</span> by +{simulationResult.shiftDays} days causes a cascade effect.
            </p>

            <div className="bg-surface-2 rounded-lg border border-border p-4 space-y-3 mb-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-tertiary font-bold uppercase tracking-wider text-[10px]">Downstream Tasks Affected</span>
                <span className="font-bold text-signal-warning">{simulationResult.impact.affectedEntities.length} tasks</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-tertiary font-bold uppercase tracking-wider text-[10px]">Total ETA Delay</span>
                <span className="font-bold text-signal-critical">+{simulationResult.impact.etaDelta} days</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-tertiary font-bold uppercase tracking-wider text-[10px]">Risk Increases</span>
                <span className="font-bold text-signal-critical">{simulationResult.impact.riskDelta} items became HIGH risk</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setSimulationResult(null)}
                className="px-4 py-2 text-sm font-bold text-text-secondary hover:text-text-primary transition-colors"
              >
                Revert Change
              </button>
              <button
                onClick={applySimulation}
                className="px-4 py-2 bg-signal-warning text-signal-warning-bg hover:brightness-110 font-bold rounded-lg text-sm shadow-lg shadow-signal-warning/20 transition-all flex items-center gap-2"
              >
                Accept Risk & Apply <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
