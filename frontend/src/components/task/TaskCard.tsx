import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User, ArrowRight, ArrowUp, AlertTriangle, Clock, Users, Shield, Link2, MoreHorizontal, Edit2 } from 'lucide-react';
import { formatUserName } from '../../utils/userFormatting';
import { Task, Project } from '../../types';
import { getTaskDeadline } from '../../core/types/temporal';
import { calculateTaskCountdown } from '../../services/etaService';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { TaskTimerUI } from './TaskTimerUI';

interface TaskCardProps {
  task: Task;
  project?: Project;
  hasWriteAccess: boolean;
  columns: { id: string; title: string; color: string }[];
  onTransitionTask: (taskId: string, targetStatus: Task['status']) => void;
  onEditTask?: (task: Task) => void;
  onPromoteToAsset?: (task: { title: string; description: string; projectId: string }) => void;
  onClick: (task: Task) => void;
  assigneeProfile?: { full_name?: string; email?: string; avatar_url?: string; role?: string; availability_factor?: number } | null;
  assigneeLoading?: boolean;
  blockedByTasks?: string[];
  dependencyConfidence?: number;
  density?: 'comfortable' | 'compact' | 'executive';
  substate?: string;
  blockers?: any[];
  onOpenWaitState?: (task: Task) => void;
}

export const TaskCard = React.memo(function TaskCard({
  task,
  project,
  hasWriteAccess,
  columns,
  onTransitionTask,
  onEditTask,
  onPromoteToAsset,
  onClick,
  assigneeProfile,
  assigneeLoading,
  blockedByTasks,
  dependencyConfidence,
  density = 'comfortable',
  substate,
  blockers,
  onOpenWaitState
}: TaskCardProps) {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const countdown = calculateTaskCountdown(task.created_at, task.estimated_hours, task.status);

  const riskColors: Record<string, string> = {
    high: 'text-signal-critical bg-signal-critical-bg border-signal-critical/20',
    medium: 'text-signal-warning bg-signal-warning-bg border-signal-warning/20',
    low: 'text-signal-safe bg-signal-safe-bg border-signal-safe/20'
  };

  const priorityColors: Record<string, string> = {
    high: 'text-signal-critical',
    medium: 'text-signal-warning',
    low: 'text-signal-safe'
  };

  const isCompact = density === 'compact';
  const isExecutive = density === 'executive';

  // Real-time metrics calculations
  const elapsedDays = (Date.now() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24);
  const estimatedDays = (task.estimated_hours || 0) / 8;
  const drift = elapsedDays - estimatedDays;
  const isOverdue = task.estimated_hours > 0 && drift > 0;
  const isStalled = isOverdue || (blockedByTasks && blockedByTasks.length > 0) || task.status === 'review';
  const elapsedHours = elapsedDays * 24;

  // Systemic liability resolution
  let liabilityTag = null;
  const taskStatusString = task.status as string;
  if (taskStatusString === 'blocked' || taskStatusString === 'passive_wait') {
    liabilityTag = 'Liability: External Client';
  } else if (taskStatusString === 'review') {
    liabilityTag = 'Liability: Compliance Review';
  } else if (task.name.toLowerCase().includes('client') || task.name.toLowerCase().includes('server setup')) {
    liabilityTag = 'Liability: External Client';
  }

  // Active Blocker Tracking
  const activeBlocker = blockers?.find(b => b.task_id === task.id && !b.resolved);
  const blockerDurationDays = activeBlocker 
    ? (Date.now() - new Date(activeBlocker.created_at).getTime()) / (1000 * 60 * 60 * 24) 
    : 0;

  const isBlocked = task.status === 'blocked' || activeBlocker;

  const [breadcrumb, setBreadcrumb] = useState<{epic?: string, story?: string, module?: string}>({});
  
  useEffect(() => {
    let mounted = true;
    async function loadIdentity() {
      if (!task.epic_id && !task.story_id && !task.module_id) return;
      
      const identity: {epic?: string, story?: string, module?: string} = {};
      
      if (task.epic_id) {
        const { data } = await import('../../lib/supabase').then(m => m.supabase.from('epics').select('name').eq('id', task.epic_id).single());
        if (data) identity.epic = data.name;
      }
      
      if (task.story_id) {
        const { data } = await import('../../lib/supabase').then(m => m.supabase.from('stories').select('title').eq('id', task.story_id).single());
        if (data) identity.story = data.title;
      }

      if (task.module_id) {
        const { data } = await import('../../lib/supabase').then(m => m.supabase.from('project_modules').select('name').eq('id', task.module_id).single());
        if (data) identity.module = data.name;
      }
      
      if (mounted) setBreadcrumb(identity);
    }
    loadIdentity();
    return () => { mounted = false; };
  }, [task.epic_id, task.story_id, task.module_id]);

  return (
    <motion.div
      onClick={() => onClick(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(task);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Task: ${task.name}. Status: ${task.status}.`}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      whileDrag={{ 
        scale: 1.02, 
        boxShadow: "0 20px 35px rgba(124, 58, 237, 0.25), 0 0 15px rgba(124, 58, 237, 0.15)", 
        opacity: 0.95 
      }}
      className={`group relative shrink-0 w-full premium-panel premium-hover-lift overflow-hidden cursor-pointer rounded-2xl ${
        isBlocked 
          ? 'border-[var(--signal-critical)] bg-[var(--signal-critical-bg)]/20 shadow-[0_0_15px_rgba(239,68,68,0.08)] bg-red-500/[0.02]' 
          : 'border-[var(--border-soft)]'
      } ${isCompact ? 'p-2' : isExecutive ? 'p-5' : 'p-4'}`}
    >
      {/* Status accent strip */}
      <div className={`absolute top-0 bottom-0 left-0 w-1 ${
        isBlocked ? 'bg-rose-500' :
        task.status === 'completed' ? 'bg-emerald-500' :
        task.status === 'in_progress' ? 'bg-amber-500' :
        task.status === 'review' ? 'bg-purple-500' :
        'bg-[var(--surface-glass)]'
      }`} />

      <div className="flex flex-col gap-2.5">
        {/* Top metadata */}
        {!isCompact && (
          <div className="flex justify-between items-center">
            <div className="flex flex-wrap items-center gap-1.5 overflow-hidden">
              <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded truncate uppercase tracking-widest">
                {task.uid || task.id.substring(0, 8)}
              </span>
              
              {breadcrumb.epic && (
                <>
                  <span className="text-[var(--text-secondary)] text-[10px]">|</span>
                  <span className="text-[10px] font-medium text-[var(--text-secondary)] truncate">
                    {breadcrumb.epic}
                  </span>
                </>
              )}
              {breadcrumb.story && (
                <>
                  <span className="text-[var(--text-secondary)] text-[10px]">&gt;</span>
                  <span className="text-[10px] font-medium text-[var(--text-secondary)] truncate">
                    {breadcrumb.story}
                  </span>
                </>
              )}
              {breadcrumb.module && (
                <>
                  <span className="text-[var(--text-secondary)] text-[10px]">M:</span>
                  <span className="text-[10px] font-medium text-indigo-400 truncate">
                    {breadcrumb.module}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {substate && (
                <span className="bg-[var(--surface-glass)] text-purple-300 border border-[var(--border-soft)] text-[8px] font-bold font-mono px-1.5 py-0.5 rounded uppercase leading-none">
                  {substate.replace(/_/g, ' ')}
                </span>
              )}
              {task.priority && (
                <div className="flex items-center gap-1 font-mono">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    task.priority === 'high' ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]' :
                    task.priority === 'medium' ? 'bg-amber-500 shadow-[0_0_6px_#f59e0b]' :
                    'bg-emerald-500 shadow-[0_0_6px_#10b981]'
                  }`} title={`Priority: ${task.priority}`} />
                  <span className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider">{task.priority}</span>
                </div>
              )}
              <MoreHorizontal className="w-3.5 h-3.5 text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )}

        {/* Title */}
        <div className="flex justify-between items-start gap-2">
          <h4 className={`font-semibold leading-snug transition-colors text-white ${
            isCompact ? 'text-[11px]' : isExecutive ? 'text-[14px]' : 'text-[13px]'
          }`}>
            {task.name}
          </h4>
        </div>

        {/* Dynamic Timeline Tracking Row */}
        {task.estimated_hours > 0 && !isCompact && (
          <div className="w-full mt-1.5 mb-0.5 group/timeline relative">
            <div className="w-full h-1 bg-[var(--surface-glass)] rounded-full overflow-hidden opacity-60 group-hover/timeline:opacity-100 transition-opacity">
              <div
                className={`h-full rounded-full transition-all ${isOverdue ? 'bg-rose-500' : 'bg-purple-500'}`}
                style={{ width: `${Math.min(100, (elapsedHours / task.estimated_hours) * 100)}%` }}
              />
            </div>
            <div className="absolute hidden group-hover/timeline:flex -top-5 left-0 text-[9px] font-mono uppercase tracking-widest text-[var(--text-secondary)] bg-[var(--surface-glass)] border border-[var(--border-soft)] p-1 rounded shadow-sm z-10">
              Elapsed: {elapsedHours.toFixed(1)}h / {task.estimated_hours.toFixed(1)}h
            </div>
          </div>
        )}

        {/* Description */}
        {!isCompact && task.description && (
          <p className="text-[11px] leading-relaxed line-clamp-2 text-[var(--text-secondary)]">
            {task.description}
          </p>
        )}

        {/* Middle Stats/Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {task.risk && task.risk !== 'low' && (
            <span className={`flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full border ${
              task.risk === 'high' ? 'text-rose-400 border-rose-500/20 bg-rose-500/5' : 'text-amber-400 border-amber-500/20 bg-amber-500/5'
            }`}>
              <AlertTriangle className="w-2.5 h-2.5" />
              {task.risk}
            </span>
          )}

          {activeBlocker && (
            <span className="flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full border border-rose-500/20 bg-rose-500/5 text-rose-400 font-mono">
              <Clock className="w-2.5 h-2.5" />
              {blockerDurationDays.toFixed(1)}d Blocked
            </span>
          )}

          {drift > 0 && task.status !== 'completed' && (
            <span className="flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-400" title={`Timeline drift of ${drift.toFixed(1)} days detected.`}>
              +{drift.toFixed(0)}d drift
            </span>
          )}

          {task.story_points && (
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full border border-[var(--border-soft)] bg-[var(--surface-glass)] text-[var(--text-secondary)]">
              {task.story_points} SP
            </span>
          )}

          {(task.deadline || task.due_date) && (
            <span className="flex items-center gap-1 text-[9px] font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full font-mono">
              <Clock className="w-2.5 h-2.5" />
              {new Date(getTaskDeadline(task)!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-1 pt-2.5 border-t border-[var(--border-soft)]">
          <div className="flex items-center gap-2">
            {assigneeProfile ? (
              <div className="flex items-center gap-1.5">
                {assigneeProfile.avatar_url ? (
                  <img src={assigneeProfile.avatar_url} className="w-5 h-5 rounded-full ring-1 ring-purple-500/35 object-cover" alt="" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-[var(--surface-glass)] border border-[var(--border-soft)] flex items-center justify-center ring-1 ring-white/5">
                    <User className="w-3 h-3 text-[var(--text-secondary)]" />
                  </div>
                )}
                {!isCompact && (
                  <span className="text-[10px] font-medium text-[var(--text-secondary)] truncate max-w-[120px]">
                    {formatUserName(assigneeProfile)}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5" title="No assignee">
                <div className="w-5 h-5 rounded-full border border-dashed border-rose-500/50 bg-rose-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                </div>
                {!isCompact && <span className="text-[10px] font-medium text-rose-400">Unassigned</span>}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {task.status !== 'completed' && (
              <div className={`flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-md border ${
                countdown.color === 'text-rose-400' 
                  ? 'text-rose-400 border-rose-500/10 bg-rose-500/5' 
                  : 'text-[var(--text-secondary)] border-[var(--border-soft)] bg-[var(--surface-glass)]'
              }`}>
                <span className={`w-1 h-1 rounded-full ${countdown.color === 'text-rose-400' ? 'bg-rose-400 animate-pulse' : 'bg-[var(--surface-glass)]'}`} />
                {countdown.text.replace('ETA: ', '')}
              </div>
            )}

            {hasWriteAccess && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1 bg-[#0b0f19]/80 rounded-lg border border-[var(--border-soft)] p-0.5 shadow-sm">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEditTask) {
                      onEditTask(task);
                    }
                  }}
                  className="p-2 md:p-1 hover:bg-[var(--surface-hover)] rounded transition-colors text-[var(--text-secondary)] hover:text-purple-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-500 flex items-center justify-center min-w-[44px] min-h-[44px] md:min-w-[24px] md:min-h-[24px]"
                  title="Edit task"
                  aria-label={`Edit task ${task.name}`}
                >
                  <Edit2 className="w-4 h-4 md:w-3 md:h-3" />
                </button>
                <div className="w-px h-3 bg-[var(--surface-glass)] mx-0.5" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const currentIndex = columns.findIndex(c => c.id === task.status);
                    const prevIndex = Math.max(0, currentIndex - 1);
                    if (prevIndex !== currentIndex) {
                      onTransitionTask(task.id, columns[prevIndex].id as Task['status']);
                    }
                  }}
                  className="p-2 md:p-1 hover:bg-[var(--surface-hover)] rounded transition-colors text-[var(--text-secondary)] hover:text-white flex items-center justify-center min-w-[44px] min-h-[44px] md:min-w-[24px] md:min-h-[24px]"
                  title="Move backward"
                >
                  <ArrowRight className="w-4 h-4 md:w-3 md:h-3 rotate-180" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const currentIndex = columns.findIndex(c => c.id === task.status);
                    const nextIndex = Math.min(columns.length - 1, currentIndex + 1);
                    if (nextIndex !== currentIndex) {
                      onTransitionTask(task.id, columns[nextIndex].id as Task['status']);
                    }
                  }}
                  className="p-2 md:p-1 hover:bg-[var(--surface-hover)] rounded transition-colors text-[var(--text-secondary)] hover:text-white flex items-center justify-center min-w-[44px] min-h-[44px] md:min-w-[24px] md:min-h-[24px]"
                  title="Move forward"
                >
                  <ArrowRight className="w-4 h-4 md:w-3 md:h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action Bar */}
        {hasWriteAccess && onOpenWaitState && task.status !== 'completed' && !isCompact && (
          <div className="mt-2 pt-2 border-t border-[var(--border-soft)] flex justify-between items-center">
            <div className="flex gap-1 overflow-x-auto no-scrollbar">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenWaitState(task);
                }}
                className="flex items-center gap-1.5 px-3 min-h-[44px] bg-[var(--surface-glass)] hover:bg-amber-500/10 text-[var(--text-secondary)] hover:text-amber-400 text-[10px] font-mono uppercase tracking-wide rounded-lg border border-[var(--border-soft)] hover:border-amber-500/30 transition-colors cursor-pointer"
              >
                <Clock className="w-3 h-3" />
                <span className="hidden sm:inline">Delay</span>
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTransitionTask(task.id, 'completed');
                }}
                className="flex items-center gap-1.5 px-3 min-h-[44px] bg-[var(--surface-glass)] hover:bg-emerald-500/10 text-[var(--text-secondary)] hover:text-emerald-400 text-[10px] font-mono uppercase tracking-wide rounded-lg border border-[var(--border-soft)] hover:border-emerald-500/30 transition-colors cursor-pointer"
              >
                <span className="hidden sm:inline">Done</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onEditTask) onEditTask(task);
                }}
                className="flex items-center gap-1.5 px-3 min-h-[44px] bg-[var(--surface-glass)] hover:bg-purple-500/10 text-[var(--text-secondary)] hover:text-purple-400 text-[10px] font-mono uppercase tracking-wide rounded-lg border border-[var(--border-soft)] hover:border-purple-500/30 transition-colors cursor-pointer"
              >
                <span className="hidden sm:inline">Upload</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onEditTask) onEditTask(task);
                }}
                className="flex items-center gap-1.5 px-3 min-h-[44px] bg-[var(--surface-glass)] hover:bg-blue-500/10 text-[var(--text-secondary)] hover:text-blue-400 text-[10px] font-mono uppercase tracking-wide rounded-lg border border-[var(--border-soft)] hover:border-blue-500/30 transition-colors cursor-pointer"
              >
                <span className="hidden sm:inline">Ask</span>
              </button>
            </div>
            {workspace && profile && (
              <TaskTimerUI 
                task={task as any} 
                workspace={workspace} 
                currentUser={profile} 
                isCompact={isCompact} 
              />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
});


