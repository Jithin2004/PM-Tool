import React, { useState, useMemo } from 'react';
import { Layers, ListOrdered, ClipboardList, Target, Plus, Archive, BookOpen, GitBranch, Zap } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { EmptyExecutionState } from '../../components/setup/EmptyExecutionState';
import { ExecutionReadinessPanel } from '../../components/setup/ExecutionReadinessPanel';

function getProjectIdFromPath(): string | null {
  const segments = window.location.pathname.split('/');
  if (segments[1] === 'projects' && segments[2]) return segments[2];
  return null;
}

export default function BacklogPage() {
  const projectId = getProjectIdFromPath();
  const { projects, epics: allEpics, notify, tasks } = useDashboard();
  const { workspace } = useWorkspace();

  const project = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);
  const projectEpics = useMemo(() => allEpics?.filter((e: any) => e.project_id === projectId) || [], [allEpics, projectId]);
  const projectTasks = useMemo(() => tasks.filter(t => t.project_id === projectId), [tasks, projectId]);
  const backlogTasks = useMemo(() => projectTasks.filter(t => t.status === 'backlog' || !t.sprint_id), [projectTasks]);

  const [showCreateEpic, setShowCreateEpic] = useState(false);
  const [showCreateSprint, setShowCreateSprint] = useState(false);

  const [newEpicName, setNewEpicName] = useState('');
  const [newSprintName, setNewSprintName] = useState('Sprint 1');
  const [newSprintGoal, setNewSprintGoal] = useState('');
  const [newSprintDuration, setNewSprintDuration] = useState(2);

  const hasEpics = projectEpics.length > 0;
  const hasBacklogTasks = backlogTasks.length > 0;

  const handleCreateEpic = async () => {
    if (!isSupabaseConfigured || !workspace || !newEpicName.trim() || !projectId) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from('epics').insert({
      workspace_id: workspace.id,
      project_id: projectId,
      name: newEpicName,
      status: 'backlog',
      priority: 'medium',
      created_at: now,
      updated_at: now,
    });
    if (!error) {
      notify('Epic created.', 'success');
      setNewEpicName('');
      setShowCreateEpic(false);
    }
  };

  const handleCreateSprint = async () => {
    if (!isSupabaseConfigured || !workspace || !newSprintName.trim() || !projectId) return;
    const now = new Date().toISOString();
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + newSprintDuration * 7);

    const { error } = await supabase.from('sprints').insert({
      workspace_id: workspace.id,
      project_id: projectId,
      name: newSprintName,
      goal: newSprintGoal || null,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      status: 'planned',
      velocity_committed: 0,
      velocity_completed: 0,
      created_at: now,
      updated_at: now,
    });
    if (!error) {
      notify('Sprint created.', 'success');
      setNewSprintName('Sprint 1');
      setNewSprintGoal('');
      setShowCreateSprint(false);
    }
  };

  if (!projectId || !project) {
    return (
      <main className="max-w-[1200px] mx-auto px-3 sm:px-6 py-12">
        <EmptyExecutionState
          icon={Archive}
          title="Project Not Found"
          description="The project you're looking for doesn't exist or has been archived."
        />
      </main>
    );
  }

  const mode = project.execution_mode || 'KANBAN';
  const isScrumOrHybrid = mode === 'SCRUM' || mode === 'HYBRID';

  return (
    <main className="max-w-[1200px] mx-auto px-3 sm:px-6 py-6 sm:py-12">
      <div className="flex items-center justify-between mb-6 bg-[#090a0f]/40 border border-border p-4 rounded-lg backdrop-blur-md">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary">{project.name} — Backlog</h2>
          <p className="text-[10px] font-mono text-text-tertiary uppercase">
            {isScrumOrHybrid ? 'Top-down planning: Epics → Stories → Sprints' : 'Planning center'}
          </p>
        </div>
      </div>

      <ExecutionReadinessPanel projectId={projectId} />

      <div className="mt-6 space-y-6">
        {/* Section 1: Epics — highest visual priority */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-surface-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-pink-400" />
              <h3 className="text-xs font-sans tracking-tight uppercase tracking-wider text-text-secondary">Epics</h3>
              {hasEpics && <span className="text-[9px] font-mono text-text-quaternary bg-[var(--pm-surface)]/5 px-1.5 py-0.5 rounded-sm">{projectEpics.length}</span>}
            </div>
            <button onClick={() => setShowCreateEpic(true)} className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-text-quaternary hover:text-text-secondary transition-colors">
              <Plus className="w-3 h-3" /> Add Epic
            </button>
          </div>
          <div className="p-4">
            {hasEpics ? (
              <div className="grid gap-2">
                {projectEpics.map((epic: any) => (
                  <div key={epic.id} className="flex items-center justify-between p-3 border border-border-subtle rounded-sm bg-surface-3 hover:bg-surface-3 transition-colors">
                    <div className="flex items-center gap-3">
                      <GitBranch className="w-3.5 h-3.5 text-pink-400/40" />
                      <span className="text-xs text-text-secondary">{epic.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {epic.priority && (
                        <span className={`text-[9px] font-mono uppercase ${
                          epic.priority === 'urgent' ? 'text-signal-critical' :
                          epic.priority === 'high' ? 'text-signal-warning' :
                          'text-text-quaternary'
                        }`}>{epic.priority}</span>
                      )}
                      <span className="text-[9px] font-mono text-text-quaternary uppercase bg-[var(--pm-surface)]/5 px-1.5 py-0.5 rounded-sm">{epic.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyExecutionState
                icon={BookOpen}
                title="No Epics Created Yet"
                description="WHY: Epics organize large execution objectives and improve sprint clarity. IMPACT: Without epics, work lacks strategic grouping. NEXT: Create your first epic to structure major goals."
                actionLabel="Create First Epic"
                onAction={() => setShowCreateEpic(true)}
              />
            )}
          </div>
        </div>

        {/* Section 2: Backlog Tasks — second visual priority */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-surface-3 border-b border-border">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-signal-info" />
              <h3 className="text-xs font-sans tracking-tight uppercase tracking-wider text-text-secondary">Backlog Tasks</h3>
              {hasBacklogTasks && <span className="text-[9px] font-mono text-text-quaternary bg-[var(--pm-surface)]/5 px-1.5 py-0.5 rounded-sm">{backlogTasks.length}</span>}
            </div>
          </div>
          <div className="p-4">
            {hasBacklogTasks ? (
              <div className="grid gap-1">
                {backlogTasks.slice(0, 30).map((task: any) => (
                  <div key={task.id} className="flex items-center justify-between p-2.5 border border-border-subtle rounded-sm hover:bg-surface-3 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        task.priority === 'urgent' ? 'bg-red-500' :
                        task.priority === 'high' ? 'bg-amber-500' :
                        'bg-[var(--pm-surface)]/20'
                      }`} />
                      <span className="text-xs text-text-tertiary truncate">{task.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {task.story_points > 0 && (
                        <span className="text-[9px] text-text-quaternary">{task.story_points}pt</span>
                      )}
                      {task.priority && (
                        <span className={`text-[9px] font-mono uppercase ${
                          task.priority === 'urgent' ? 'text-signal-critical' :
                          task.priority === 'high' ? 'text-signal-warning' :
                          'text-text-quaternary'
                        }`}>{task.priority}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyExecutionState
                icon={Zap}
                title="No Tasks in Backlog"
                description="WHY: Tasks represent actionable units of work for the team. IMPACT: An empty backlog means no work is queued for execution. NEXT: Break down epics into specific tasks."
                actionLabel={hasEpics ? 'Create First Task' : 'Start with an Epic First'}
                onAction={() => hasEpics ? {} : setShowCreateEpic(true)}
              />
            )}
          </div>
        </div>

        {/* Section 3: Sprint — lowest visual priority for empty state */}
        {isScrumOrHybrid && !hasBacklogTasks && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-surface-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-signal-safe" />
                <h3 className="text-xs font-sans tracking-tight uppercase tracking-wider text-text-secondary">Sprint</h3>
              </div>
              <button onClick={() => setShowCreateSprint(true)} className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-text-quaternary hover:text-text-secondary transition-colors">
                <Plus className="w-3 h-3" /> Start Sprint
              </button>
            </div>
            <div className="p-4">
              <EmptyExecutionState
                icon={Target}
                title="No Active Sprint"
                description="WHY: Sprints create time-boxed delivery cycles for predictable output. IMPACT: Without sprints, work lacks cadence and velocity tracking. NEXT: Create Sprint 1 after adding backlog items."
                actionLabel="Create Sprint"
                onAction={() => setShowCreateSprint(true)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Inline create forms */}
      {showCreateEpic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg backdrop-blur-sm" onClick={() => setShowCreateEpic(false)}>
          <div className="bg-bg border border-border rounded-lg p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-xs font-sans tracking-tight uppercase tracking-wide text-text-secondary mb-4">Create Epic</h3>
            <input
              value={newEpicName}
              onChange={e => setNewEpicName(e.target.value)}
              placeholder="Epic name"
              className="w-full bg-[var(--pm-surface)]/5 border border-border rounded-sm px-3 py-2 text-xs font-mono text-text-secondary placeholder-white/20 outline-none focus:border-border mb-4"
              onKeyDown={e => e.key === 'Enter' && handleCreateEpic()}
            />
            <div className="flex items-center gap-2">
              <button onClick={handleCreateEpic} className="px-4 py-2 bg-pink-600 text-text-primary text-[10px] font-medium uppercase tracking-wider hover:bg-pink-500 transition-all rounded-sm">Create</button>
              <button onClick={() => setShowCreateEpic(false)} className="px-4 py-2 text-text-quaternary text-[10px] font-mono uppercase tracking-wider hover:text-text-tertiary transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showCreateSprint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg backdrop-blur-sm" onClick={() => setShowCreateSprint(false)}>
          <div className="bg-bg border border-border rounded-lg p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-xs font-sans tracking-tight uppercase tracking-wide text-text-secondary mb-4">Create Sprint</h3>
            <div className="space-y-3">
              <input
                value={newSprintName}
                onChange={e => setNewSprintName(e.target.value)}
                placeholder="Sprint name"
                className="w-full bg-[var(--pm-surface)]/5 border border-border rounded-sm px-3 py-2 text-xs font-mono text-text-secondary placeholder-white/20 outline-none focus:border-border"
              />
              <input
                value={newSprintGoal}
                onChange={e => setNewSprintGoal(e.target.value)}
                placeholder="Sprint goal (optional)"
                className="w-full bg-[var(--pm-surface)]/5 border border-border rounded-sm px-3 py-2 text-xs font-mono text-text-secondary placeholder-white/20 outline-none focus:border-border"
              />
              <select
                value={newSprintDuration}
                onChange={e => setNewSprintDuration(parseInt(e.target.value))}
                className="w-full bg-[var(--pm-surface)]/5 border border-border rounded-sm px-3 py-2 text-xs font-mono text-text-secondary outline-none focus:border-border"
              >
                <option value={1}>1 Week</option>
                <option value={2}>2 Weeks</option>
                <option value={3}>3 Weeks</option>
                <option value={4}>4 Weeks</option>
              </select>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <button onClick={handleCreateSprint} className="px-4 py-2 bg-green-600 text-text-primary text-[10px] font-medium uppercase tracking-wider hover:bg-green-500 transition-all rounded-sm">Create</button>
              <button onClick={() => setShowCreateSprint(false)} className="px-4 py-2 text-text-quaternary text-[10px] font-mono uppercase tracking-wider hover:text-text-tertiary transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
