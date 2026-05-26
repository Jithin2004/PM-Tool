import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, ArrowRight, ArrowUp, AlertTriangle, Clock, Users, Shield, Link2, MoreHorizontal } from 'lucide-react';
import { Task, Project } from '../../types';
import { getTaskDeadline } from '../../core/types/temporal';
import { calculateTaskCountdown } from '../../services/etaService';

interface TaskCardProps {
  task: Task;
  project?: Project;
  hasWriteAccess: boolean;
  columns: { id: string; title: string; color: string }[];
  onTransitionTask: (taskId: string, targetStatus: Task['status']) => void;
  onPromoteToAsset?: (task: { title: string; description: string; projectId: string }) => void;
  onClick: (task: Task) => void;
  assigneeProfile?: { full_name?: string; email?: string; avatar_url?: string; role?: string; availability_factor?: number } | null;
  assigneeLoading?: boolean;
  blockedByTasks?: string[];
  dependencyConfidence?: number;
  density?: 'comfortable' | 'compact' | 'executive';
}

export function TaskCard({ 
  task, 
  project, 
  hasWriteAccess, 
  columns, 
  onTransitionTask, 
  onPromoteToAsset, 
  onClick,
  assigneeProfile,
  assigneeLoading,
  blockedByTasks,
  dependencyConfidence,
  density = 'comfortable'
}: TaskCardProps) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
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

  return (
    <motion.div
      layoutId={`task-card-${task.id}`}
      onClick={() => onClick(task)}
      className={`group relative bg-surface-2 border border-border hover:border-accent-primary/30 transition-all rounded-lg overflow-hidden cursor-pointer shadow-sm hover:shadow-premium ${
        isCompact ? 'p-2' : isExecutive ? 'p-5' : 'p-3.5'
      }`}
    >
      {/* Risk indicator side bar */}
      {task.risk && task.risk !== 'low' && (
        <div className={`absolute top-0 bottom-0 left-0 w-1 ${task.risk === 'high' ? 'bg-signal-critical' : 'bg-signal-warning'}`} />
      )}

      <div className="flex flex-col gap-2">
        {/* Top metadata */}
        {!isCompact && (
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="text-[10px] font-medium text-text-tertiary truncate">
                {project?.name || 'No Project'}
              </span>
              {task.epic_id && (
                <>
                  <span className="text-text-quaternary">/</span>
                  <span className="text-[10px] font-medium text-accent-secondary truncate uppercase tracking-tight">
                    Epic
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              {task.priority && (
                <div className={`w-1.5 h-1.5 rounded-full ${priorityColors[task.priority] || 'bg-text-tertiary'}`} title={`Priority: ${task.priority}`} />
              )}
              <MoreHorizontal className="w-3.5 h-3.5 text-text-quaternary opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )}

        {/* Title */}
        <div className="flex justify-between items-start gap-2">
          <h4 className={`font-semibold text-text-primary leading-snug group-hover:text-accent-primary transition-colors ${
            isCompact ? 'text-[11px]' : isExecutive ? 'text-[13px]' : 'text-[12px]'
          }`}>
            {task.name}
          </h4>
          {task.estimated_hours > 0 && !isCompact && (
            <span className="text-[10px] font-medium text-text-tertiary whitespace-nowrap">
              {task.estimated_hours}h
            </span>
          )}
        </div>

        {/* Description */}
        {!isCompact && task.description && (
          <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Middle Stats/Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {task.risk && (
            <span className={`flex items-center gap-1 text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border ${riskColors[task.risk] || riskColors.low}`}>
              <AlertTriangle className="w-2.5 h-2.5" />
              {task.risk}
            </span>
          )}
          
          {task.status !== 'done' && blockedByTasks && blockedByTasks.length > 0 && (
            <span className="flex items-center gap-1 text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-signal-critical-bg border border-signal-critical/20 text-signal-critical">
              <Link2 className="w-2.5 h-2.5" />
              Blocked
            </span>
          )}

          {task.story_points && (
            <span className="text-[10px] font-medium text-text-tertiary bg-surface-3 px-1.5 py-0.5 rounded">
              {task.story_points} SP
            </span>
          )}

          {(task.deadline || task.due_date) && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-text-tertiary">
              <Clock className="w-3 h-3" />
              {new Date(getTaskDeadline(task)!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-1 pt-2 border-t border-border-subtle">
          <div className="flex items-center gap-2">
            {assigneeProfile ? (
              <div className="flex items-center gap-1.5">
                {assigneeProfile.avatar_url ? (
                  <img src={assigneeProfile.avatar_url} className="w-4 h-4 rounded-full border border-border" alt="" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-surface-3 border border-border flex items-center justify-center">
                    <User className="w-2.5 h-2.5 text-text-tertiary" />
                  </div>
                )}
                {!isCompact && (
                  <span className="text-[10px] font-medium text-text-secondary truncate max-w-[80px]">
                    {assigneeProfile.full_name?.split(' ')[0] || assigneeProfile.email?.split('@')[0]}
                  </span>
                )}
              </div>
            ) : (
              <div className="w-4 h-4 rounded-full border border-dashed border-border flex items-center justify-center">
                <User className="w-2.5 h-2.5 text-text-quaternary" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {task.status !== 'done' && (
              <div className={`text-[10px] font-medium ${countdown.color === 'text-rose-400' ? 'text-signal-critical' : 'text-text-tertiary'}`}>
                {countdown.text.replace('ETA: ', '')}
              </div>
            )}
            
            {hasWriteAccess && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Basic move forward logic for quick transition
                    const currentIndex = columns.findIndex(c => c.id === task.status);
                    const nextIndex = Math.min(columns.length - 1, currentIndex + 1);
                    if (nextIndex !== currentIndex) {
                      onTransitionTask(task.id, columns[nextIndex].id as Task['status']);
                    }
                  }}
                  className="p-1 hover:bg-surface-3 rounded transition-colors text-text-tertiary hover:text-text-primary"
                >
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

