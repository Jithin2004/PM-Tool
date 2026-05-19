import React from 'react';
import { motion } from 'framer-motion';
import { User, ArrowRight, ArrowUp } from 'lucide-react';
import { Task, Project } from '../../types';
import { calculateTaskCountdown } from '../../services/etaService';

interface TaskCardProps {
  key?: any;
  task: Task;
  project?: Project;
  hasWriteAccess: boolean;
  columns: { id: string; title: string; color: string }[];
  onTransitionTask: (taskId: string, targetStatus: Task['status']) => void;
  onPromoteToAsset?: (task: { title: string; description: string; projectId: string }) => void;
  onClick: (task: Task) => void;
}

export function TaskCard({ 
  task, 
  project, 
  hasWriteAccess, 
  columns, 
  onTransitionTask, 
  onPromoteToAsset, 
  onClick 
}: TaskCardProps) {
  const countdown = calculateTaskCountdown(task.created_at, task.estimated_hours || 5, task.status);

  return (
    <motion.div
      layoutId={`task-card-${task.id}`}
      onClick={() => onClick(task)}
      className="bg-[#0b0c10] border border-white/10 hover:border-white/20 transition-all rounded-sm p-3.5 relative overflow-hidden cursor-pointer group"
    >
      {/* Dynamic warning indicator ring glows */}
      <div className={`absolute top-0 bottom-0 left-0 w-1 ${countdown.pulse}`} />

      {/* Title & Info */}
      <div className="flex justify-between items-start gap-2 mb-2">
        <h4 className="text-[11px] font-semibold text-white tracking-wide group-hover:text-blue-400 transition-colors uppercase">
          {task.name}
        </h4>
        {task.estimated_hours > 0 && (
          <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/20 border border-cyan-800/20 px-1.5 rounded-sm">
            {task.estimated_hours}h
          </span>
        )}
      </div>

      <p className="text-[9px] text-white/50 leading-relaxed mb-3 line-clamp-2">
        {task.description}
      </p>

      {/* Project mapping tag */}
      <div className="flex items-center gap-1.5 text-[8px] font-mono text-white/30 uppercase tracking-widest mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
        Project: {project?.name || 'Project'}
      </div>

      {/* Dynamic ETA Countdown Banner */}
      <div className="bg-white/[0.02] border border-white/5 px-2 py-1 rounded-sm flex justify-between items-center text-[8px] font-mono uppercase tracking-wider">
        <span className="text-white/40">Time-to-Impact:</span>
        <span className={countdown.color}>{countdown.text}</span>
      </div>

      {/* Footer details */}
      <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/5">
        <div className="flex items-center gap-1.5 text-[8px] font-mono text-white/50">
          <User className="w-2.5 h-2.5" />
          {task.assignee_id ? 'Assigned' : 'Unassigned'}
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
                className="w-4 h-4 bg-white/5 hover:bg-white/20 border border-white/10 hover:border-white/30 text-white rounded-sm flex items-center justify-center transition-all cursor-pointer"
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
