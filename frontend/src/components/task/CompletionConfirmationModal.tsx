import React from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle2, AlertTriangle, Play, ShieldAlert } from 'lucide-react';
import { Task } from '../../types';
import { WaitState } from '../../core/types/collaboration';

interface CompletionConfirmationModalProps {
  task: Task;
  waitStates: WaitState[];
  dependencies: any[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function CompletionConfirmationModal({
  task,
  waitStates,
  dependencies,
  onConfirm,
  onCancel
}: CompletionConfirmationModalProps) {
  // Mock readiness logic (should ideally be retrieved from completionReadinessEngine, but since engines are frozen, we'll run simple client checks)
  const activeWaitStates = waitStates.filter(ws => ws.target_id === task.id && ws.status === 'active');
  const unresolvedDependencies = dependencies.filter(d => d.task_id === task.id && !d.resolved);
  
  const isReady = activeWaitStates.length === 0 && unresolvedDependencies.length === 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-surface border border-white/10 p-8 rounded-2xl w-full max-w-md relative overflow-hidden shadow-2xl"
      >
        <div className={`absolute top-0 left-0 right-0 h-[3px] ${isReady ? 'bg-emerald-500' : 'bg-red-500'}`} />
        
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-sm font-semibold tracking-wide uppercase text-text-primary flex items-center gap-2">
              {isReady ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
              )}
              {isReady ? 'Ready for Completion' : 'Completion Blocked'}
            </h3>
            <p className="text-[11px] text-text-quaternary mt-1 max-w-[90%] line-clamp-1">
              Task: {task.name}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-md hover:bg-white/5 text-text-quaternary hover:text-text-primary transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 mb-8">
          <div className="bg-surface-2/50 border border-border/50 rounded-lg p-4 space-y-3">
            <h4 className="text-[10px] font-medium uppercase tracking-widest text-text-tertiary mb-2">
              Readiness Checks
            </h4>
            
            <div className="flex items-center gap-3">
              {activeWaitStates.length === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-500" />
              )}
              <span className={`text-xs ${activeWaitStates.length === 0 ? 'text-text-secondary' : 'text-text-primary font-medium'}`}>
                {activeWaitStates.length === 0 ? 'No active wait states' : `${activeWaitStates.length} Active Wait State(s)`}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              {unresolvedDependencies.length === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-500" />
              )}
              <span className={`text-xs ${unresolvedDependencies.length === 0 ? 'text-text-secondary' : 'text-text-primary font-medium'}`}>
                {unresolvedDependencies.length === 0 ? 'Dependencies satisfied' : `${unresolvedDependencies.length} Unresolved Dependencies`}
              </span>
            </div>
          </div>

          {!isReady && (
            <div className="text-[11px] text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
              You cannot complete this task until all blockers and wait states are resolved.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-white/5 pt-5">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-text-tertiary hover:text-text-primary hover:bg-white/5 rounded-lg transition-all cursor-pointer"
          >
            {isReady ? 'Cancel' : 'View Blockers'}
          </button>
          {isReady && (
            <button
              onClick={onConfirm}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              Complete Task
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
