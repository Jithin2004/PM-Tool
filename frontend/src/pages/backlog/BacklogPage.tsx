import React, { useState, useMemo } from 'react';
import { Layers, ListOrdered, ClipboardList, Target, Plus, Archive, BookOpen, GitBranch, Zap } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { EmptyExecutionState } from '../../components/setup/EmptyExecutionState';
import { ExecutionReadinessPanel } from '../../components/setup/ExecutionReadinessPanel';
import { EmptyState, PageShell, PageHeader, PageContent, Button, Input, Modal } from '../../components/core';

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
      <PageShell maxWidth="standard">
        <EmptyExecutionState
          icon={Archive}
          title="Project Not Found"
          description="The project you're looking for doesn't exist or has been archived."
        />
      </PageShell>
    );
  }

  const mode = project.execution_mode || 'KANBAN';
  const isScrumOrHybrid = mode === 'SCRUM' || mode === 'HYBRID';

  return (
    <PageShell maxWidth="standard">
      <PageHeader
        title={`${project.name} — Backlog`}
        overline="Project Backlog & Sprints"
        description={isScrumOrHybrid ? 'Top-down planning: Epics → Stories → Sprints' : 'Planning center'}
      />

      <ExecutionReadinessPanel projectId={projectId} />

      <PageContent>
        {/* Section 1: Epics — highest visual priority */}
        <div className="border border-[var(--color-border)] rounded-lg overflow-hidden bg-[var(--color-surface-1)]">
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-surface-2)] border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[var(--color-primary)]" />
              <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Epics</h3>
              {hasEpics && (
                <span className="text-[10px] font-semibold text-[var(--color-text-muted)] bg-[var(--color-surface-3)] px-1.5 py-0.5 rounded-sm">
                  {projectEpics.length}
                </span>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowCreateEpic(true)}
              className="text-[10px] font-medium"
            >
              Add Epic
            </Button>
          </div>
          <div className="p-4">
            {hasEpics ? (
              <div className="grid gap-2">
                {projectEpics.map((epic: any) => (
                  <div key={epic.id} className="flex items-center justify-between p-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-2)] hover:border-[var(--color-primary)] transition-colors">
                    <div className="flex items-center gap-3">
                      <GitBranch className="w-4 h-4 text-[var(--color-text-muted)]" />
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{epic.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {epic.priority && (
                        <span className={`text-[10px] font-semibold uppercase ${
                          epic.priority === 'urgent' ? 'text-[var(--color-danger)]' :
                          epic.priority === 'high' ? 'text-[var(--color-warning)]' :
                          'text-[var(--color-text-muted)]'
                        }`}>{epic.priority}</span>
                      )}
                      <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase bg-[var(--color-surface-3)] px-1.5 py-0.5 rounded-sm">{epic.status}</span>
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
        <div className="border border-[var(--color-border)] rounded-lg overflow-hidden bg-[var(--color-surface-1)]">
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-surface-2)] border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-[var(--color-primary)]" />
              <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Backlog Tasks</h3>
              {hasBacklogTasks && (
                <span className="text-[10px] font-semibold text-[var(--color-text-muted)] bg-[var(--color-surface-3)] px-1.5 py-0.5 rounded-sm">
                  {backlogTasks.length}
                </span>
              )}
            </div>
          </div>
          <div className="p-4">
            {hasBacklogTasks ? (
              <div className="grid gap-1">
                {backlogTasks.slice(0, 30).map((task: any) => (
                  <div key={task.id} className="flex items-center justify-between p-2.5 border border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary)] transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        task.priority === 'urgent' ? 'bg-[var(--color-danger)]' :
                        task.priority === 'high' ? 'bg-[var(--color-warning)]' :
                        'bg-[var(--color-border)]'
                      }`} />
                      <span className="text-sm text-[var(--color-text-secondary)] truncate">{task.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {task.story_points > 0 && (
                        <span className="text-[11px] text-[var(--color-text-muted)] font-medium">{task.story_points}pt</span>
                      )}
                      {task.priority && (
                        <span className={`text-[10px] font-semibold uppercase ${
                          task.priority === 'urgent' ? 'text-[var(--color-danger)]' :
                          task.priority === 'high' ? 'text-[var(--color-warning)]' :
                          'text-[var(--color-text-muted)]'
                        }`}>{task.priority}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Zap}
                title="Your Backlog is Empty"
                description="The backlog is where your team lines up future work. Add tasks here so developers always know what's coming next."
                action={
                  <Button onClick={() => hasEpics ? {} : setShowCreateEpic(true)} size="sm">
                    {hasEpics ? 'Create First Task' : 'Start with an Epic First'}
                  </Button>
                }
              />
            )}
          </div>
        </div>

        {/* Section 3: Sprint — lowest visual priority for empty state */}
        {isScrumOrHybrid && !hasBacklogTasks && (
          <div className="border border-[var(--color-border)] rounded-lg overflow-hidden bg-[var(--color-surface-1)]">
            <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-surface-2)] border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-[var(--color-success)]" />
                <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Sprint</h3>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowCreateSprint(true)}
                className="text-[10px] font-medium"
              >
                Start Sprint
              </Button>
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
      </PageContent>

      {/* Core Dialog Modals */}
      <Modal
        isOpen={showCreateEpic}
        onClose={() => setShowCreateEpic(false)}
        title="Create Epic"
        primaryActionLabel="Create"
        onPrimaryAction={handleCreateEpic}
        secondaryActionLabel="Cancel"
        onSecondaryAction={() => setShowCreateEpic(false)}
      >
        <Input
          label="Epic Name *"
          required
          value={newEpicName}
          onChange={e => setNewEpicName(e.target.value)}
          placeholder="Enter epic name"
          onKeyDown={e => e.key === 'Enter' && handleCreateEpic()}
        />
      </Modal>

      <Modal
        isOpen={showCreateSprint}
        onClose={() => setShowCreateSprint(false)}
        title="Create Sprint"
        primaryActionLabel="Create"
        onPrimaryAction={handleCreateSprint}
        secondaryActionLabel="Cancel"
        onSecondaryAction={() => setShowCreateSprint(false)}
      >
        <div className="space-y-4">
          <Input
            label="Sprint Name *"
            required
            value={newSprintName}
            onChange={e => setNewSprintName(e.target.value)}
            placeholder="Sprint name"
          />
          <Input
            label="Sprint Goal (Optional)"
            value={newSprintGoal}
            onChange={e => setNewSprintGoal(e.target.value)}
            placeholder="Sprint goal description"
          />
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">Duration</label>
            <select
              value={newSprintDuration}
              onChange={e => setNewSprintDuration(parseInt(e.target.value))}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] transition-all"
            >
              <option value={1}>1 Week</option>
              <option value={2}>2 Weeks</option>
              <option value={3}>3 Weeks</option>
              <option value={4}>4 Weeks</option>
            </select>
          </div>
        </div>
      </Modal>
    </PageShell>
  );
}
