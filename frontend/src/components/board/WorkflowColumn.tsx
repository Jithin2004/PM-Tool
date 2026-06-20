import React, { useState } from 'react';
import { Task } from '../../types';
import { WorkflowState } from '../../services/workflowService';
import { DroppableWorkflowColumn } from './DroppableWorkflowColumn';
import { TaskCard } from '../task/TaskCard';
import { AlertTriangle } from 'lucide-react';

import { DraggableWorkItem } from '../execution/dragDrop/DraggableWorkItem';

interface WorkflowColumnProps {
  state: WorkflowState | null; // null for 'Needs Mapping'
  tasks: Task[];
  onDropTask: (taskId: string, targetStateId: string) => void;
  // Passthrough props for TaskCard
  projectMap: Map<string, any>;
  userMap: Map<string, any>;
  hasWriteAccess: any;
  blockedByMap: Map<string, string[]>;
  onTransitionTask: (taskId: string, targetStatus: any) => void;
  onEditTask: (task: Task) => void;
  onTaskClick: (task: Task) => void;
  density: 'comfortable' | 'compact' | 'executive';
  taskSubstates: Record<string, string>;
  blockers: any[];
}

export const WorkflowColumn: React.FC<WorkflowColumnProps> = ({
  state,
  tasks,
  onDropTask,
  projectMap,
  userMap,
  hasWriteAccess,
  blockedByMap,
  onTransitionTask,
  onEditTask,
  onTaskClick,
  density,
  taskSubstates,
  blockers
}) => {
  const [limit, setLimit] = useState(50);
  const isNeedsMapping = state === null;

  const title = isNeedsMapping ? 'Needs Mapping' : state.name;
  const stateCategory = isNeedsMapping ? 'unmapped' : state.state_category;
  
  // Parse WIP limit from metadata
  let wipLimit = 0;
  if (state?.metadata && typeof state.metadata === 'object' && 'wip_limit' in state.metadata) {
    wipLimit = Number(state.metadata.wip_limit);
  }

  const isOverloaded = wipLimit > 0 && tasks.length > wipLimit;

  // Determine a color based on the category
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'backlog': return 'bg-surface-3';
      case 'not_started': return 'bg-teal-500';
      case 'active': return 'bg-indigo-500';
      case 'review': return 'bg-purple-500';
      case 'blocked': return 'bg-rose-500';
      case 'completed': return 'bg-emerald-500';
      case 'cancelled': return 'bg-neutral-500';
      case 'unmapped': return 'bg-orange-500';
      default: return 'bg-surface-3';
    }
  };

  const color = getCategoryColor(stateCategory);

  const innerContent = (
    <>
      <div className="flex items-center justify-between mb-3 px-1 pt-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${color}`} />
          <h3 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wider truncate max-w-[200px]">
            {title}
          </h3>
          <span className="text-[11px] font-medium text-text-tertiary bg-surface-2 px-1.5 py-0.5 rounded border border-border">
            {wipLimit > 0 ? `${tasks.length}/${wipLimit}` : tasks.length}
          </span>
          {isOverloaded && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-signal-critical bg-signal-critical-bg px-1.5 py-0.5 rounded" title="Overloaded">
               <AlertTriangle size={12} />
               <span>WIP Exceeded</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin">
        {tasks.length === 0 ? (
          <div className="h-24 border border-dashed border-border rounded-lg flex items-center justify-center text-[11px] text-text-quaternary font-medium uppercase tracking-widest">
            No Tasks
          </div>
        ) : (
          <>
            {tasks.slice(0, limit).map((task) => (
              <DraggableWorkItem
                key={task.id}
                id={task.id}
                type="task"
                data={task}
                isDisabled={typeof hasWriteAccess === 'function' ? !hasWriteAccess(task) : !hasWriteAccess}
              >
                <TaskCard
                  task={task}
                  project={projectMap.get(task.project_id)}
                  hasWriteAccess={typeof hasWriteAccess === 'function' ? hasWriteAccess(task) : hasWriteAccess}
                  columns={[]} // Not strictly used inside if onTransitionTask is handled separately
                  onTransitionTask={onTransitionTask}
                  onEditTask={onEditTask}
                  onClick={onTaskClick}
                  assigneeProfile={task.assignee_id ? userMap.get(task.assignee_id) : null}
                  blockedByTasks={blockedByMap.get(task.id)}
                  density={density}
                  substate={taskSubstates[task.id]}
                  blockers={blockers}
                />
              </DraggableWorkItem>
            ))}
            {tasks.length > limit && (
              <button 
                onClick={() => setLimit(prev => prev + 50)}
                className="w-full py-2 bg-surface-3 hover:bg-surface-high border border-border rounded-lg text-xs font-semibold transition-colors mt-2 text-text-secondary"
              >
                Load More Tasks ({tasks.length - limit} remaining)
              </button>
            )}
          </>
        )}
      </div>
    </>
  );

  // If "Needs Mapping", we shouldn't allow dropping INTO it normally, but for safety we wrap anyway.
  if (isNeedsMapping) {
    return (
      <div className="flex flex-col min-w-[300px] h-full rounded-lg p-1 border-2 border-orange-500/30 bg-orange-500/5">
        {innerContent}
        <div className="mt-4 px-2">
           <p className="text-xs text-orange-400 mb-2">These tasks exist but are missing workflow states.</p>
           {/* In reality, we will handle this mapping via settings, but maybe add a button here later */}
        </div>
      </div>
    );
  }

  return (
    <DroppableWorkflowColumn stateId={state.id} onDrop={onDropTask}>
      {innerContent}
    </DroppableWorkflowColumn>
  );
};
