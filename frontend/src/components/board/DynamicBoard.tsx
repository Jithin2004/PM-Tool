import React, { useState, useEffect, useMemo } from 'react';
import { Task } from '../../types';
import { WorkflowState } from '../../services/workflowService';
import { workflowResolver, ResolvedWorkflow } from '../../core/workflow/workflowResolver';
import { taskStateManager } from '../../core/workflow/taskStateManager';
import { WorkflowColumn } from './WorkflowColumn';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { Filter, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';

interface DynamicBoardProps {
  tasks: Task[];
  projectMap: Map<string, any>;
  userMap: Map<string, any>;
  hasWriteAccess: any;
  blockedByMap: Map<string, string[]>;
  onEditTask: (task: Task) => void;
  onTaskClick: (task: Task) => void;
  density: 'comfortable' | 'compact' | 'executive';
  taskSubstates: Record<string, string>;
  blockers: any[];
  projectId?: string; // We need to know which project we are looking at to resolve the workflow
  onRefreshIntelligence: () => void;
}

export const DynamicBoard: React.FC<DynamicBoardProps> = ({
  tasks,
  projectMap,
  userMap,
  hasWriteAccess,
  blockedByMap,
  onEditTask,
  onTaskClick,
  density,
  taskSubstates,
  blockers,
  projectId,
  onRefreshIntelligence
}) => {
  const { workspace: currentWorkspace } = useWorkspace();
  const { sprints } = useDashboard();
  const [workflow, setWorkflow] = useState<ResolvedWorkflow | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [sprintFilter, setSprintFilter] = useState<'active' | 'all' | string>('active');

  useEffect(() => {
    async function loadWorkflow() {
      if (!projectId) {
        // If viewing across all projects, fallback to a standard state mapped board?
        // Actually, the requirements say "Dynamic Workflow Board Engine... load project.workflow_template_id".
        // If we don't have a specific project, we might need a generic board or just fallback.
        // For Phase 2C, let's assume we use the first available system template if projectId is missing.
        const defaultWf = await workflowResolver.resolveProjectWorkflow('00000000-0000-0000-0000-000000000000');
        setWorkflow(defaultWf);
      } else {
        const wf = await workflowResolver.resolveProjectWorkflow(projectId);
        setWorkflow(wf);
      }
      setLoading(false);
    }
    loadWorkflow();
  }, [projectId]);

  const handleDropTask = async (taskId: string, targetStateId: string) => {
    if (!currentWorkspace?.id) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (typeof hasWriteAccess === 'function' ? !hasWriteAccess(task) : !hasWriteAccess) {
      // Should Ideally notify error
      console.error("Access Denied to move task");
      return;
    }

    const success = await taskStateManager.moveTaskState(
      currentWorkspace.id,
      taskId,
      targetStateId
    );

    if (success) {
      onRefreshIntelligence();
    }
  };

  const activeSprint = useMemo(() => {
    return sprints?.find((s: any) => s.status === 'active');
  }, [sprints]);

  const displayTasks = useMemo(() => {
    return tasks.filter(t => {
      if (sprintFilter === 'active') {
        return activeSprint ? t.sprint_id === activeSprint.id || t.status !== 'done' : t.status !== 'done';
      }
      if (sprintFilter === 'all') return true;
      return t.sprint_id === sprintFilter;
    });
  }, [tasks, sprintFilter, activeSprint]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-text-tertiary">
        <Zap className="w-10 h-10 mb-4 opacity-50 text-orange-500" />
        <p>No workflow configured and fallback failed.</p>
      </div>
    );
  }

  // Map tasks to columns
  const unmappedTasks: Task[] = [];
  const stateTaskMap = new Map<string, Task[]>();

  workflow.states.forEach(s => stateTaskMap.set(s.id, []));

  displayTasks.forEach(task => {
    if (task.workflow_state_id && stateTaskMap.has(task.workflow_state_id)) {
      stateTaskMap.get(task.workflow_state_id)!.push(task);
    } else {
      unmappedTasks.push(task);
    }
  });

  return (
    <div className="flex flex-col h-full">
      {/* Board Controls */}
      <div className="flex items-center justify-between mb-4 px-1 shrink-0">
        <div className="flex items-center gap-4">
          {workflow.isFallback && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-lg text-[11px] font-medium">
              <Zap size={12} />
              Using Fallback Workflow
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-2 border border-border px-3 py-1.5 rounded-lg text-[11px] font-medium text-text-secondary">
            <Filter size={14} />
            <select
              value={sprintFilter}
              onChange={(e) => setSprintFilter(e.target.value)}
              className="bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
            >
              <option value="active">Active Sprint (Default)</option>
              <option value="all">All Tasks</option>
              {sprints?.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Columns container */}
      <div className="flex-1 min-h-0">
        <div className="flex gap-4 h-full overflow-x-auto pb-4 scrollbar-thin">
          {workflow.states.map(state => (
            <WorkflowColumn
              key={state.id}
              state={state}
              tasks={stateTaskMap.get(state.id) || []}
              onDropTask={handleDropTask}
              projectMap={projectMap}
              userMap={userMap}
              hasWriteAccess={hasWriteAccess}
              blockedByMap={blockedByMap}
              onTransitionTask={() => { }} // Disabled legacy transition here
              onEditTask={onEditTask}
              onTaskClick={onTaskClick}
              density={density}
              taskSubstates={taskSubstates}
              blockers={blockers}
            />
          ))}

          {unmappedTasks.length > 0 && (
            <WorkflowColumn
              key="unmapped"
              state={null} // Null state represents "Needs Mapping"
              tasks={unmappedTasks}
              onDropTask={() => { }} // Can't drop into Needs Mapping
              projectMap={projectMap}
              userMap={userMap}
              hasWriteAccess={hasWriteAccess}
              blockedByMap={blockedByMap}
              onTransitionTask={() => { }}
              onEditTask={onEditTask}
              onTaskClick={onTaskClick}
              density={density}
              taskSubstates={taskSubstates}
              blockers={blockers}
            />
          )}
        </div>
      </div>
    </div>
  );
};
