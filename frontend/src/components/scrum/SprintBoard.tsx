import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, TrendingUp, TrendingDown, Target, Zap, Users, ChevronDown, Plus, X, Terminal,
  AlertTriangle, Calendar, Clock, BookOpen, ListChecks, BarChart3, GitBranch, CheckCircle2,
  LayoutList, Layers, FileText
} from 'lucide-react';
import { EntityAttachments } from '../files/EntityAttachments';
import { PremiumEmptyState } from '../common/PremiumEmptyState';
import type { Sprint, Task, User, Epic, Project, CalendarEvent } from '../../types';
import { supabase } from '../../lib/supabase';
import { TaskCard } from '../task/TaskCard';
import { TaskCreateModal } from '../task/TaskCreateModal';
import { TaskEditModal } from '../task/TaskEditModal';
import { CompletionFeedbackModal } from '../task/CompletionFeedbackModal';
import { SCRUM_COLUMNS } from '../../constants/product';
import { activityLogService } from '../../services/activityLogService';
import { hasCapability } from '../../core/auth/permissions';

type ScrumTab = 'product-backlog' | 'sprint-planner' | 'sprint-backlog' | 'active-sprint' | 'sprint-review' | 'velocity-analytics' | 'definition-of-done' | 'sprint-files';

interface SprintBoardProps {
  project: Project;
  projectId: string;
  workspaceId: string;
  sprints: Sprint[];
  tasks: Task[];
  users: User[];
  epics: Epic[];
  calendarEvents?: CalendarEvent[];
  currentUserProfile: User | null;
  notify: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onUpdateTaskStatus: (taskId: string, status: Task['status']) => Promise<void>;
  onCreateTask: (taskData: any) => Promise<void>;
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onCreateSprint: (sprint: Omit<Sprint, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onConvertToScrum?: (projectId: string) => Promise<void>;
  allKanbanProjects?: Project[];
}

export function SprintBoard({
  project, projectId, workspaceId, sprints, tasks, users, epics, calendarEvents = [],
  currentUserProfile, notify, onUpdateTaskStatus, onUpdateTask, onCreateTask, onCreateSprint,
  onConvertToScrum, allKanbanProjects
}: SprintBoardProps) {
  const [activeTab, setActiveTab] = useState<ScrumTab>('active-sprint');
  const [activeSprintId, setActiveSprintId] = useState<string | null>(sprints.find(s => s.status === 'active')?.id || null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isCreatingSprint, setIsCreatingSprint] = useState(false);
  const [isAddingExisting, setIsAddingExisting] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [sprintName, setSprintName] = useState('');
  const [sprintGoal, setSprintGoal] = useState('');
  const [sprintStart, setSprintStart] = useState('');
  const [sprintEnd, setSprintEnd] = useState('');
  const [sprintVelocity, setSprintVelocity] = useState(0);
  const [selectedEpic, setSelectedEpic] = useState<string | null>(null);

  const hasWriteAccess = hasCapability(currentUserProfile?.role, 'task.update');

  const [pendingCompletionTask, setPendingCompletionTask] = useState<Task | null>(null);

  const handleStatusChange = async (taskId: string, status: Task['status']) => {
    if (status === 'completed') {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setPendingCompletionTask(task);
        return;
      }
    }
    await onUpdateTaskStatus(taskId, status);
  };

  const userMap = useMemo(() => {
    const map = new Map<string, any>();
    users.forEach(u => map.set(u.id, u));
    return map;
  }, [users]);

  const sprintTasks = useMemo(() => {
    if (!activeSprintId) return tasks.filter(t => t.project_id === projectId);
    return tasks.filter(t => t.sprint_id === activeSprintId);
  }, [tasks, activeSprintId, projectId]);

  const activeSprint = useMemo(() => sprints.find(s => s.id === activeSprintId) || null, [sprints, activeSprintId]);

  const velocityData = useMemo(() => {
    if (!activeSprint) return { committed: 0, completed: 0, remaining: 0 };
    const committed = sprintTasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
    const completed = sprintTasks.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.story_points || 0), 0);
    return { committed, completed, remaining: committed - completed };
  }, [sprintTasks, activeSprint]);

  const burndownPoints = useMemo(() => {
    if (!activeSprint) return { totalDays: 0, daysElapsed: 0, ideal: 0, actual: 0, progress: 0 };
    const start = new Date(activeSprint.start_date);
    const end = new Date(activeSprint.end_date);
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    const totalSP = velocityData.committed;
    const dailyRate = totalSP / totalDays;
    const now = new Date();
    const daysElapsed = Math.min(totalDays, Math.max(0, Math.ceil((now.getTime() - start.getTime()) / 86400000)));
    const ideal = Math.max(0, totalSP - dailyRate * daysElapsed);
    return { totalDays, daysElapsed, ideal, actual: velocityData.remaining, progress: totalSP > 0 ? Math.round((velocityData.completed / totalSP) * 100) : 0 };
  }, [activeSprint, velocityData]);

  // Sprint Engine Warnings
  const sprintWarnings = useMemo(() => {
    const warnings: Array<{ id: string; type: 'overload' | 'dependency' | 'holiday' | 'leave' | 'velocity'; message: string; severity: 'high' | 'medium' | 'low' }> = [];

    if (!activeSprint) return warnings;

    // Holiday collision detection from CalendarEvents
    const sprintEvents = calendarEvents.filter(e => {
      return e.start_date <= activeSprint.end_date && e.end_date >= activeSprint.start_date;
    });
    const holidays = sprintEvents.filter(e => e.event_type === 'holiday');
    holidays.forEach(h => {
      warnings.push({
        id: `hol-${h.id}`,
        type: 'holiday',
        message: `Holiday collision: "${h.title}" on ${h.start_date} reduces sprint capacity`,
        severity: 'medium'
      });
    });

    // Leave collision detection
    const leaves = sprintEvents.filter(e => e.event_type === 'leave');
    leaves.forEach(l => {
      if (l.participants) {
        l.participants.forEach(pid => {
          const user = userMap.get(pid);
          warnings.push({
            id: `lev-${l.id}-${pid}`,
            type: 'leave',
            message: `${user?.full_name || pid} on leave ${l.start_date}–${l.end_date} (${Math.round((1 - l.capacity_impact) * 100)}% impact)`,
            severity: 'high'
          });
        });
      }
    });

    // Team overload detection
    const assigneeHours = new Map<string, number>();
    sprintTasks.forEach(t => {
      if (t.assignee_id && t.status !== 'completed') {
        assigneeHours.set(t.assignee_id, (assigneeHours.get(t.assignee_id) || 0) + (t.estimated_hours || 0));
      }
    });
    assigneeHours.forEach((hours, userId) => {
      const user = userMap.get(userId);
      const cap = 40 * (user?.availability_factor || 1);
      if (hours > cap) {
        warnings.push({
          id: `overload-${userId}`,
          type: 'overload',
          message: `${user?.full_name || userId} overloaded: ${hours}h / ${cap}h capacity`,
          severity: 'high'
        });
      }
    });

    // Dependency blockage detection
    const taskDepMap = new Map<string, string[]>();
    const sprintTaskIds = new Set(sprintTasks.map(t => t.id));
    const incompleteIds = new Set(sprintTasks.filter(t => t.status !== 'completed').map(t => t.id));
    const blockedTasks: string[] = [];
    tasks.forEach(t => {
      if (t.sprint_id === activeSprint.id) {
        const deps = tasks.filter(d => d.id !== t.id && d.project_id === t.project_id);
        deps.forEach(d => {
          if (d.status !== 'completed' && sprintTaskIds.has(d.id)) {
            blockedTasks.push(t.id);
          }
        });
      }
    });
    if (blockedTasks.length > 0) {
      warnings.push({
        id: 'dep-blockage',
        type: 'dependency',
        message: `${blockedTasks.length} task(s) blocked by incomplete dependencies in sprint`,
        severity: 'medium'
      });
    }

    // Velocity breach
    if (velocityData.committed > 0) {
      const projected = velocityData.completed / Math.max(1, burndownPoints.daysElapsed) * burndownPoints.totalDays;
      if (projected < velocityData.committed * 0.7) {
        warnings.push({
          id: 'velocity-breach',
          type: 'velocity',
          message: `Projected velocity (${projected.toFixed(1)} SP) below 70% of committed (${velocityData.committed} SP)`,
          severity: 'high'
        });
      }
    }

    return warnings;
  }, [activeSprint, sprintTasks, tasks, userMap, velocityData, burndownPoints]);

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintName || !sprintStart || !sprintEnd) { notify('Name, start, and end date required.', 'error'); return; }
    if (new Date(sprintEnd) <= new Date(sprintStart)) { notify('End must be after start.', 'error'); return; }
    await onCreateSprint({
      workspace_id: workspaceId, project_id: projectId, name: sprintName, goal: sprintGoal || null,
      start_date: sprintStart, end_date: sprintEnd, status: 'planned',
      velocity_committed: sprintVelocity, velocity_completed: 0
    });
    await activityLogService.appendLog({
      workspace_id: workspaceId, actor_id: currentUserProfile?.id,
      project_id: projectId, action_type: 'sprint_created',
      metadata: { sprint_name: sprintName, start_date: sprintStart, end_date: sprintEnd }
    });
    notify('Sprint created.', 'success');
    setSprintName(''); setSprintGoal(''); setSprintStart(''); setSprintEnd(''); setSprintVelocity(0);
    setIsCreatingSprint(false);
  };

  const handleAddExistingProject = async (selectedProjectId: string) => {
    if (onConvertToScrum) {
      await onConvertToScrum(selectedProjectId);
      await activityLogService.appendLog({
        workspace_id: workspaceId, actor_id: currentUserProfile?.id,
        project_id: selectedProjectId, action_type: 'converted_to_scrum',
        metadata: { previous_mode: 'KANBAN', new_mode: 'SCRUM' }
      });
      notify('Project converted to Scrum.', 'success');
      setIsAddingExisting(false);
    }
  };

  const handleStartSprint = async (sprintId: string) => {
    try {
      const { supabase } = await import('../../lib/supabase');
      await supabase.from('sprints').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', sprintId);
      setActiveSprintId(sprintId);
      await activityLogService.appendLog({
        workspace_id: workspaceId, actor_id: currentUserProfile?.id,
        project_id: projectId, action_type: 'sprint_started',
        metadata: { sprint_id: sprintId }
      });
      notify('Sprint started.', 'success');
    } catch {
      notify('Failed to start sprint.', 'error');
    }
  };

  const tabs: { id: ScrumTab; label: string; icon: React.ReactNode }[] = [
    { id: 'product-backlog', label: 'Product Backlog', icon: <BookOpen className="w-3 h-3" /> },
    { id: 'sprint-planner', label: 'Sprint Planner', icon: <Calendar className="w-3 h-3" /> },
    { id: 'sprint-backlog', label: 'Sprint Backlog', icon: <ListChecks className="w-3 h-3" /> },
    { id: 'active-sprint', label: 'Active Sprint', icon: <Zap className="w-3 h-3" /> },
    { id: 'sprint-review', label: 'Sprint Review', icon: <CheckCircle2 className="w-3 h-3" /> },
    { id: 'velocity-analytics', label: 'Velocity', icon: <BarChart3 className="w-3 h-3" /> },
    { id: 'definition-of-done', label: 'DoD', icon: <GitBranch className="w-3 h-3" /> },
    { id: 'sprint-files', label: 'Files', icon: <FileText className="w-3 h-3" /> },
  ];



  return (
    <>
      <div className="block md:hidden bg-surface border border-border-subtle rounded-xl p-8 text-center mt-4">
        <Layers className="w-12 h-12 text-accent-primary mx-auto mb-4 opacity-80" />
        <h2 className="text-lg font-bold text-text-primary mb-2">Desktop View Required</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          The Sprint Board requires a larger viewport for complex visualizations. Please access this view on a tablet or desktop device.
        </p>
      </div>

      <div className="hidden md:block w-full premium-panel rounded-2xl p-4 sm:p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500/80 via-pink-500/80 to-orange-500/80 animate-pulse" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b border-[var(--border-soft)] pb-4">
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-sans tracking-tight uppercase tracking-wide text-white">Scrum Board</h2>
            {onConvertToScrum && (
              <button onClick={() => setIsAddingExisting(true)} className="px-2 py-1 btn-premium-secondary text-[8px] font-mono uppercase tracking-wider rounded-lg border border-[var(--border-soft)] transition-all cursor-pointer">
                <Plus className="w-2.5 h-2.5 inline mr-1" />Add Existing Project
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasWriteAccess && (
              <button onClick={() => setIsCreatingSprint(true)} className="px-3.5 py-1.5 btn-premium-primary text-[9px] font-mono uppercase tracking-wide rounded-lg transition-all cursor-pointer">
                <Plus className="w-3 h-3 inline mr-1" /> New Sprint
              </button>
            )}
            {hasWriteAccess && (
              <button onClick={() => setIsAddingTask(true)} className="px-3.5 py-1.5 btn-premium-secondary text-[9px] font-mono uppercase tracking-wide rounded-lg cursor-pointer border border-[var(--border-soft)]">
                <Plus className="w-3.5 h-3.5 inline mr-1" /> Queue Story
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <select value={activeSprintId || ''} onChange={e => setActiveSprintId(e.target.value || null)} className="input-premium h-8 px-3 text-[10px] focus:border-[var(--border-soft)] outline-none rounded-lg">
            <option value="">All Tasks (No Sprint)</option>
            {sprints.map(s => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
          </select>
          {sprints.filter(s => s.status === 'planned').map(s => (
            <button key={s.id} onClick={() => handleStartSprint(s.id)} className="px-2.5 py-1 bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-300 text-[8px] font-mono uppercase rounded-lg border border-emerald-500/20 transition-all cursor-pointer">
              Start {s.name}
            </button>
          ))}
        </div>

        {/* Sprint engine warnings */}
        {sprintWarnings.length > 0 && (
          <div className="mb-4 space-y-1">
            {sprintWarnings.map(w => (
              <div key={w.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-[9px] font-mono ${w.severity === 'high' ? 'bg-rose-950/30 border border-rose-500/20 text-rose-300' :
                w.severity === 'medium' ? 'bg-signal-warning-bg border border-border text-amber-300' :
                  'bg-surface-3 border border-border text-blue-300'
                }`}>
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>{w.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tab navigation */}
        <div className="flex premium-segmented-control mb-5 overflow-x-auto max-w-max">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer shrink-0 premium-segmented-control-btn ${activeTab === tab.id
              ? 'active'
              : ''
              }`}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'active-sprint' && (
          <>
            {activeSprint && (
              <div className="mb-6 bg-surface-3 border border-border px-4 py-3 rounded-sm flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-accent-secondary" />
                  <span className="text-[10px] font-mono uppercase tracking-wide text-purple-200">{activeSprint.name}</span>
                  {activeSprint.goal && <span className="text-[9px] font-mono text-purple-300/60">— {activeSprint.goal}</span>}
                </div>
                <div className="flex items-center gap-6 text-[9px] font-mono text-purple-300 uppercase tracking-wide">
                  <div className="flex items-center gap-1">
                    {velocityData.remaining > 0 ? <TrendingDown className="w-3 h-3 text-signal-warning" /> : <TrendingUp className="w-3 h-3 text-emerald-400" />}
                    <span>Remaining: <span className="text-text-primary font-bold">{velocityData.remaining} SP</span></span>
                  </div>
                  <div>Velocity: <span className="text-text-primary font-bold">{velocityData.completed}/{velocityData.committed}</span></div>
                  <div>Progress: <span className="text-emerald-400 font-bold">{burndownPoints.progress}%</span></div>
                </div>
              </div>
            )}

            {/* Burndown */}
            {activeSprint && burndownPoints.totalDays > 0 && (
              <div className="mb-6 bg-bg border border-border-subtle rounded-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[9px] font-mono uppercase tracking-wide text-text-tertiary">Burndown Trajectory</span>
                </div>
                <div className="flex items-end gap-[2px] h-16">
                  {Array.from({ length: burndownPoints.totalDays + 1 }).map((_, i) => {
                    const maxSP = Math.max(1, burndownPoints.totalDays > 0 ? (velocityData.committed / burndownPoints.totalDays) * (burndownPoints.totalDays - i) : 0);
                    const idealH = velocityData.committed > 0 ? (maxSP / velocityData.committed) * 100 : 0;
                    const isPast = i <= burndownPoints.daysElapsed;
                    return (
                      <div key={i} className="flex-1 flex flex-col justify-end h-full">
                        <div className="w-full bg-[var(--pm-surface)]/5 rounded-t-sm relative" style={{ height: `${Math.max(2, idealH)}%` }}>
                          {isPast && <div className="absolute bottom-0 left-0 right-0 bg-surface-3 rounded-t-sm" style={{ height: `${Math.max(2, (velocityData.remaining / Math.max(1, velocityData.committed)) * 100)}%` }} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[8px] font-mono text-text-quaternary mt-1">
                  <span>Day 0</span><span>Day {burndownPoints.daysElapsed}</span><span>Day {burndownPoints.totalDays}</span>
                </div>
              </div>
            )}

            {/* Epic filter */}
            {epics.length > 0 && (
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-mono uppercase text-text-quaternary">Epic:</span>
                <button onClick={() => setSelectedEpic(null)} className={`px-2 py-0.5 text-[8px] font-mono uppercase rounded-sm cursor-pointer ${!selectedEpic ? 'bg-purple-600 text-text-primary' : 'bg-[var(--pm-surface)]/5 text-text-quaternary hover:text-text-primary'}`}>All</button>
                {epics.map(ep => (
                  <button key={ep.id} onClick={() => setSelectedEpic(ep.id)} className={`px-2 py-0.5 text-[8px] font-mono uppercase rounded-sm cursor-pointer ${selectedEpic === ep.id ? 'bg-purple-600 text-text-primary' : 'bg-[var(--pm-surface)]/5 text-text-quaternary hover:text-text-primary'}`}>{ep.name}</button>
                ))}
              </div>
            )}

            {/* SCRUM columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {SCRUM_COLUMNS.map(col => {
                const colTasks = sprintTasks.filter(t => {
                  if (t.status !== col.id) return false;
                  if (selectedEpic && t.epic_id !== selectedEpic) return false;
                  return true;
                });
                return (
                  <div key={col.id} className="premium-panel rounded-2xl p-4 flex flex-col min-h-[400px]">
                    <div className="flex justify-between items-center mb-4 pb-2.5 border-b border-[var(--border-soft)]">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-secondary)] font-semibold flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${col.id === 'todo' ? 'bg-[var(--surface-glass)]' :
                          col.id === 'in_progress' ? 'bg-amber-500 shadow-[0_0_6px_#f59e0b]' :
                            col.id === 'review' ? 'bg-purple-500 shadow-[0_0_6px_#a78bfa]' :
                              'bg-emerald-500 shadow-[0_0_6px_#10b981]'
                          }`} />
                        {col.title}
                      </span>
                      <span className="px-2 py-0.5 bg-[var(--surface-glass)] text-[9px] font-mono text-[var(--text-secondary)] rounded-full border border-[var(--border-soft)]">{colTasks.length}</span>
                    </div>
                    <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1 max-h-[450px]">
                      {colTasks.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-2 text-center">
                          <PremiumEmptyState
                            icon={Layers}
                            title="No Tasks"
                            description="This stage is empty."
                          />
                        </div>
                      ) : (
                        colTasks.map(task => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            project={null as any}
                            hasWriteAccess={hasWriteAccess}
                            columns={SCRUM_COLUMNS as any}
                            onTransitionTask={handleStatusChange}
                            onEditTask={setEditingTask}
                            onClick={() => { }}
                            assigneeProfile={task.assignee_id ? userMap.get(task.assignee_id) : null}
                            assigneeLoading={!!task.assignee_id && !userMap.has(task.assignee_id)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'product-backlog' && (
          <div className="bg-surface-3 border border-border-subtle rounded-sm p-4">
            <h3 className="text-[10px] font-sans tracking-tight uppercase tracking-wide text-text-secondary mb-4">Product Backlog</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {tasks.filter(t => t.project_id === projectId && !t.sprint_id).length === 0 ? (
                <div className="py-12 text-center text-text-quaternary font-mono text-[9px] uppercase">No unassigned stories in backlog</div>
              ) : (
                tasks.filter(t => t.project_id === projectId && !t.sprint_id).map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-3 bg-bg border border-border-subtle rounded-sm hover:border-border transition-colors">
                    <div className={`w-2 h-2 rounded-full ${task.status === 'completed' ? 'bg-emerald-400' : task.status === 'in_progress' ? 'bg-yellow-400' : 'bg-[var(--pm-surface)]/20'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-mono text-text-secondary truncate">{task.name}</p>
                      <p className="text-[8px] font-mono text-text-quaternary">{task.story_points ? `${task.story_points} SP` : ''} · {task.estimated_hours}h</p>
                    </div>
                    {task.epic_id && <span className="text-[8px] font-mono text-accent-secondary bg-surface-3 px-1.5 py-0.5 rounded-sm">Epic bound</span>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'sprint-planner' && (
          <div className="bg-surface-3 border border-border-subtle rounded-sm p-4">
            <h3 className="text-[10px] font-sans tracking-tight uppercase tracking-wide text-text-secondary mb-4">Sprint Planner — Capacity: {activeSprint ? `${velocityData.committed} SP committed` : 'No active sprint'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-[9px] font-sans tracking-tight uppercase text-text-tertiary mb-2">Available Stories</h4>
                {tasks.filter(t => t.project_id === projectId && !t.sprint_id).slice(0, 10).map(task => (
                  <div key={task.id} className="flex items-center gap-2 p-2 border border-border-subtle mb-1 rounded-sm text-[9px] font-mono text-text-secondary">
                    <span className="flex-1 truncate">{task.name}</span>
                    <span className="text-accent-secondary">{task.story_points || '-'} SP</span>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="text-[9px] font-sans tracking-tight uppercase text-text-tertiary mb-2">Velocity History</h4>
                {sprints.filter(s => s.status === 'completed').slice(0, 5).map(s => (
                  <div key={s.id} className="flex items-center gap-2 p-2 border border-border-subtle mb-1 rounded-sm text-[9px] font-mono text-text-secondary">
                    <span className="flex-1 truncate">{s.name}</span>
                    <span className="text-emerald-400">{s.velocity_completed}/{s.velocity_committed} SP</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sprint-backlog' && (
          <div className="bg-surface-3 border border-border-subtle rounded-sm p-4">
            <h3 className="text-[10px] font-sans tracking-tight uppercase tracking-wide text-text-secondary mb-4">Sprint Backlog</h3>
            <div className="space-y-2">
              {sprintTasks.length === 0 ? (
                <div className="py-12 text-center text-text-quaternary font-mono text-[9px] uppercase"><span className="text-[11px] text-[var(--text-muted)] font-mono">Sprint backlog is empty.</span></div>
              ) : (
                sprintTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-3 bg-bg border border-border-subtle rounded-sm">
                    <div className={`w-2 h-2 rounded-full ${task.status === 'completed' ? 'bg-emerald-400' : task.status === 'in_progress' ? 'bg-yellow-400' : 'bg-[var(--pm-surface)]/20'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-mono text-text-secondary truncate">{task.name}</p>
                      <p className="text-[8px] font-mono text-text-quaternary">{task.status.replace('_', ' ')} · {task.story_points || '-'} SP</p>
                    </div>
                    {task.epic_id && <span className="text-[8px] font-mono text-accent-secondary bg-surface-3 px-1.5 py-0.5 rounded-sm">Epic</span>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'sprint-review' && (
          <div className="bg-surface-3 border border-border-subtle rounded-sm p-4">
            <h3 className="text-[10px] font-sans tracking-tight uppercase tracking-wide text-text-secondary mb-4">Sprint Review</h3>
            {sprints.filter(s => s.status === 'completed').length === 0 ? (
              <div className="py-12 text-center text-text-quaternary font-mono text-[9px] uppercase">No completed sprints to review</div>
            ) : (
              <div className="space-y-3">
                {sprints.filter(s => s.status === 'completed').slice(0, 5).map(s => (
                  <div key={s.id} className="p-3 bg-bg border border-border-subtle rounded-sm">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-mono text-text-secondary uppercase">{s.name}</span>
                      <span className="text-[8px] font-mono text-emerald-400">{s.velocity_completed}/{s.velocity_committed} SP completed</span>
                    </div>
                    {s.goal && <p className="text-[8px] font-mono text-text-quaternary">Goal: {s.goal}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'velocity-analytics' && (
          <div className="bg-surface-3 border border-border-subtle rounded-sm p-4">
            <h3 className="text-[10px] font-sans tracking-tight uppercase tracking-wide text-text-secondary mb-4">Velocity Analytics</h3>
            {sprints.filter(s => s.status === 'completed').length === 0 ? (
              <div className="py-12 text-center text-text-quaternary font-sans text-xs">Completed sprints will appear here</div>
            ) : (
              <div className="space-y-3">
                {sprints.filter(s => s.status === 'completed').map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-2 border border-border-subtle rounded-sm">
                    <span className="text-[9px] font-mono text-text-secondary w-32 truncate">{s.name}</span>
                    <div className="flex-1 h-4 bg-[var(--pm-surface)]/5 rounded-sm overflow-hidden">
                      <div className="h-full bg-purple-500 transition-all" style={{ width: `${s.velocity_committed > 0 ? (s.velocity_completed / s.velocity_committed) * 100 : 0}%` }} />
                    </div>
                    <span className="text-[8px] font-mono text-text-quaternary">{Math.round(s.velocity_committed > 0 ? (s.velocity_completed / s.velocity_committed) * 100 : 0)}%</span>
                  </div>
                ))}
                {(() => {
                  const avg = sprints.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.velocity_completed, 0) / Math.max(1, sprints.filter(s => s.status === 'completed').length);
                  return (
                    <div className="mt-4 p-3 bg-surface-3 border border-border rounded-sm text-[9px] font-mono">
                      <span className="text-purple-300">Average Velocity: <strong className="text-text-primary">{avg.toFixed(1)} SP</strong> per sprint</span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {activeTab === 'definition-of-done' && (
          <div className="bg-surface-3 border border-border-subtle rounded-sm p-4">
            <h3 className="text-[10px] font-sans tracking-tight uppercase tracking-wide text-text-secondary mb-4">Definition of Done</h3>
            <div className="space-y-2">
              {[
                'Code reviewed by at least one peer',
                'All acceptance criteria met',
                'Unit tests passing',
                'Integration tests passing',
                'Documentation updated',
                'No critical or high-severity bugs',
                'Deployed to staging environment',
                'Product owner approval obtained'
              ].map((item, i) => (
                <label key={i} className="flex items-center gap-2 p-2 border border-border-subtle rounded-sm text-[9px] font-mono text-text-secondary cursor-pointer hover:bg-[var(--pm-surface-hover)]">
                  <input type="checkbox" className="accent-purple-500" />
                  {item}
                </label>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sprint-files' && (
          <div className="bg-surface-3 border border-border-subtle rounded-sm p-4">
            <h3 className="text-[10px] font-sans tracking-tight uppercase tracking-wide text-text-secondary mb-4">Sprint Files</h3>
            {activeSprintId ? (
              <div className="h-64 overflow-y-auto">
                <EntityAttachments
                  workspaceId={workspaceId}
                  entityType="project"
                  entityId={activeSprintId}
                  readOnly={!hasWriteAccess}
                />
              </div>
            ) : (
              <div className="py-12 text-center text-text-quaternary font-mono text-[9px] uppercase">Please select a sprint to manage files</div>
            )}
          </div>
        )}

        {/* Modals */}
        <AnimatePresence>
          <TaskCreateModal isOpen={isAddingTask} onClose={() => setIsAddingTask(false)} projects={[project]} users={users} defaultStatus="assigned" defaultProjectId={project.id} onSubmit={onCreateTask} notify={notify} />

          {editingTask && (
            <TaskEditModal
              isOpen={!!editingTask}
              onClose={() => setEditingTask(null)}
              task={editingTask}
              projects={[project]}
              users={users}
              onSubmit={async (taskId, updates) => {
                if (onUpdateTask) {
                  await onUpdateTask(taskId, updates);
                }
              }}
              notify={notify}
            />
          )}

          {isCreatingSprint && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCreatingSprint(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative modal-premium w-full max-w-md p-6 rounded-2xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-sans tracking-tight uppercase tracking-wide text-white">Create Sprint</h3>
                  <button onClick={() => setIsCreatingSprint(false)} className="p-1.5 hover:bg-[var(--surface-hover)] rounded-md cursor-pointer"><X className="w-3.5 h-3.5 text-[var(--text-secondary)]" /></button>
                </div>
                <form onSubmit={handleCreateSprint} className="space-y-4">
                  <div><label className="block text-[10px] font-mono uppercase text-[var(--text-secondary)] mb-1.5">Name</label><input value={sprintName} onChange={e => setSprintName(e.target.value)} className="w-full input-premium h-10 px-3 text-sm" placeholder="Sprint 1..." /></div>
                  <div><label className="block text-[10px] font-mono uppercase text-[var(--text-secondary)] mb-1.5">Goal</label><input value={sprintGoal} onChange={e => setSprintGoal(e.target.value)} className="w-full input-premium h-10 px-3 text-sm" placeholder="Sprint goal..." /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-[10px] font-mono uppercase text-[var(--text-secondary)] mb-1.5">Start</label><input type="date" value={sprintStart} onChange={e => setSprintStart(e.target.value)} className="w-full input-premium h-10 px-3 text-xs" /></div>
                    <div><label className="block text-[10px] font-mono uppercase text-[var(--text-secondary)] mb-1.5">End</label><input type="date" value={sprintEnd} onChange={e => setSprintEnd(e.target.value)} className="w-full input-premium h-10 px-3 text-xs" /></div>
                  </div>
                  <div><label className="block text-[10px] font-mono uppercase text-[var(--text-secondary)] mb-1.5">Committed Velocity (SP)</label><input type="number" value={sprintVelocity} onChange={e => setSprintVelocity(Number(e.target.value))} className="w-full input-premium h-10 px-3 text-sm" /></div>
                  <button type="submit" className="w-full btn-premium-primary h-10 font-semibold uppercase tracking-wide text-[10px] rounded-lg">Create Sprint</button>
                </form>
              </motion.div>
            </div>
          )}

          {isAddingExisting && allKanbanProjects && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddingExisting(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative modal-premium w-full max-w-md p-6 rounded-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-sans tracking-tight uppercase tracking-wide text-white">Add Existing Project</h3>
                  <button onClick={() => setIsAddingExisting(false)} className="p-1.5 hover:bg-[var(--surface-hover)] rounded-md cursor-pointer"><X className="w-3.5 h-3.5 text-[var(--text-secondary)]" /></button>
                </div>
                <p className="text-[9px] font-mono text-[var(--text-secondary)] mb-4">Convert a Kanban project to Scrum. It will be removed from the Kanban board.</p>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {allKanbanProjects.filter(p => p.id !== projectId).map(p => (
                    <button key={p.id} onClick={() => handleAddExistingProject(p.id)} className="w-full text-left p-3 border border-[var(--border-soft)] hover:border-purple-500/50 rounded-lg text-[10px] font-mono text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-all cursor-pointer">
                      {p.name}
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {pendingCompletionTask && (
          <CompletionFeedbackModal
            task={pendingCompletionTask}
            onSubmit={async (feedback) => {
              await supabase.from('prediction_validations').insert({
                task_id: pendingCompletionTask.id,
                workspace_id: workspaceId,
                predicted_hours: pendingCompletionTask.estimated_hours || 0,
                actual_hours: feedback.actual_effort,
                deviation_reason: feedback.deviation_reason,
                outcome: Math.abs(feedback.actual_effort - (pendingCompletionTask.estimated_hours || 0)) / Math.max(1, pendingCompletionTask.estimated_hours || 1) <= 0.2 ? 'accurate' : 'deviated'
              });
              await onUpdateTaskStatus(pendingCompletionTask.id, 'completed');
              setPendingCompletionTask(null);
            }}
            onSkip={async () => {
              await onUpdateTaskStatus(pendingCompletionTask.id, 'completed');
              setPendingCompletionTask(null);
            }}
            onClose={() => setPendingCompletionTask(null)}
          />
        )}
      </div>
    </>
  );
}


