import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, ArrowRight, ArrowUp, AlertTriangle, Clock, Users, Shield } from 'lucide-react';
import { Task, Project } from '../../types';
import { calculateTaskCountdown, getSchedulingReason } from '../../services/etaService';

interface TaskCardProps {
  key?: any;
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
  dependencyConfidence
}: TaskCardProps) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);
  const countdown = calculateTaskCountdown(task.created_at, task.estimated_hours, task.status);
  const nextSlot = task.predicted_completion && task.status !== 'done'
    ? `Slot: ${new Date(task.predicted_completion).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
    : null;

  const riskColors: Record<string, string> = {
    high: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    medium: 'text-signal-warning bg-signal-warning-bg border-border',
    low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  };

  return (
    <motion.div
      layoutId={`task-card-${task.id}`}
      onClick={() => onClick(task)}
      className="bg-[#0b0c10] border border-border hover:border-border transition-all rounded-sm p-3.5 relative overflow-hidden cursor-pointer group"
    >
      {/* Dynamic warning indicator ring glows */}
      <div className={`absolute top-0 bottom-0 left-0 w-1 ${countdown.pulse}`} />

      {/* Title & Info */}
      <div className="flex justify-between items-start gap-2 mb-2">
        <h4 className="text-[11px] font-semibold text-text-primary tracking-wide group-hover:text-signal-info transition-colors uppercase">
          {task.name}
        </h4>
        {task.estimated_hours > 0 && (
          <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/20 border border-cyan-800/20 px-1.5 rounded-sm shrink-0">
            {task.estimated_hours}h
          </span>
        )}
      </div>

      <p className="text-[9px] text-text-tertiary leading-relaxed mb-2 line-clamp-2">
        {task.description}
      </p>

      {/* Risk & confidence badges */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {task.risk && (
          <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded-sm border ${riskColors[task.risk] || riskColors.low}`}>
            <AlertTriangle className="w-2 h-2 inline mr-0.5" />
            {task.risk}
          </span>
        )}
        {task.confidence !== undefined && task.confidence !== null && (
          <span className="text-[8px] font-mono text-text-tertiary bg-white/5 px-1.5 py-0.5 rounded-sm">
            {(task.confidence * 100).toFixed(0)}% conf
          </span>
        )}
        {task.delay_drift_days > 0 && (
          <span className="text-[8px] font-mono text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-sm">
            +{task.delay_drift_days}d drift
          </span>
        )}
        {task.story_points && (
          <span className="text-[8px] font-mono text-accent-secondary bg-surface-3 px-1.5 py-0.5 rounded-sm">
            {task.story_points} SP
          </span>
        )}
      </div>

      {/* Assignee section */}
      <div className="flex items-center gap-1.5 text-[8px] font-mono text-text-tertiary mb-2">
        <Users className="w-2.5 h-2.5 shrink-0" />
        {assigneeLoading ? (
          <span className="text-cyan-400/60 transition-opacity duration-300">Loading telemetry...</span>
        ) : assigneeProfile ? (
          <span className="flex items-center gap-1.5">
            {assigneeProfile.avatar_url ? (
              <img src={assigneeProfile.avatar_url} className="w-3.5 h-3.5 rounded-full" alt="" />
            ) : (
              <User className="w-3 h-3 text-text-quaternary" />
            )}
            <span className="text-text-secondary">{assigneeProfile.full_name || assigneeProfile.email}</span>
            {assigneeProfile.role && (
              <span className="text-text-quaternary uppercase">({assigneeProfile.role.replace('_', ' ')})</span>
            )}
            {assigneeProfile.availability_factor !== undefined && (
              <span className="text-cyan-400/60">
                {Math.round(assigneeProfile.availability_factor * 100)}% avail
              </span>
            )}
          </span>
        ) : task.assignee_id ? (
          <span className="text-text-quaternary">Loading telemetry...</span>
        ) : (
          <span className="text-text-quaternary">No task estimates available</span>
        )}
      </div>

      {/* Blocked by and dependency info */}
      {blockedByTasks && blockedByTasks.length > 0 && (
        <div className="mb-2 px-2 py-1 bg-rose-950/20 border border-rose-500/15 rounded-sm">
          <span className="text-[7px] font-mono uppercase text-rose-400/80">
            <AlertTriangle className="w-2 h-2 inline mr-0.5" />
            Blocked by: {blockedByTasks.length} task{blockedByTasks.length > 1 ? 's' : ''}
          </span>
        </div>
      )}
      {dependencyConfidence !== undefined && (
        <div className="mb-2 px-2 py-1 bg-surface-3 border border-border-subtle rounded-sm">
          <span className="text-[7px] font-mono uppercase text-text-quaternary">
            Dep confidence: {Math.round(dependencyConfidence * 100)}%
          </span>
        </div>
      )}

      {/* Dynamic ETA Countdown Banner */}
      <div className="bg-surface-3 border border-border-subtle px-2 py-1 rounded-sm flex justify-between items-center text-[8px] font-mono uppercase tracking-wider">
        <span className="text-text-quaternary">Time-to-Impact:</span>
        <span className={countdown.color}>{countdown.text}</span>
      </div>
      {nextSlot && (
        <div className="px-2 py-1 text-[7px] font-mono text-cyan-400/60 uppercase tracking-wide">
          {nextSlot}
        </div>
      )}

      {/* Footer details */}
      <div className="flex justify-between items-center mt-3 pt-2 border-t border-border-subtle">
        <div className="flex items-center gap-1.5 text-[8px] font-mono text-text-tertiary">
          <Shield className="w-2.5 h-2.5" />
          <span>{project?.name || 'Project'}</span>
        </div>
        
        {/* Quick lane transition buttons (For Admins/PMs) */}
        {hasWriteAccess && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {columns.map(c => c.id !== task.status && (
              <button
                key={c.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onTransitionTask(task.id, c.id as Task['status']);
                }}
                title={`Move to ${c.title}`}
                className="w-4 h-4 bg-white/5 hover:bg-white/20 border border-border hover:border-white/30 text-text-primary rounded-sm flex items-center justify-center transition-all cursor-pointer"
              >
                <ArrowRight className="w-2 h-2" />
              </button>
            ))}
            {onPromoteToAsset && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPromoteToAsset({ title: task.name, description: task.description || '', projectId: task.project_id });
                }}
                title="Elevate task to Project workspace"
                className="w-4 h-4 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/20 hover:border-emerald-400/40 text-emerald-400 rounded-sm flex items-center justify-center transition-all cursor-pointer"
              >
                <ArrowUp className="w-2 h-2" />
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
