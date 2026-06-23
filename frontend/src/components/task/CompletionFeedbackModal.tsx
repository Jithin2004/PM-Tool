import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, AlertTriangle, Clock, BookOpen, Layers } from 'lucide-react';
import type { Task } from '../../types';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface CompletionFeedback {
  actual_effort: number;
  deviation_reason: string;
  blockers: string;
  lessons_learned: string;
}

interface CompletionFeedbackModalProps {
  task: Task;
  onSubmit: (feedback: CompletionFeedback) => void;
  onSkip: () => void;
  onClose: () => void;
}

export function CompletionFeedbackModal({ task, onSubmit, onSkip, onClose }: CompletionFeedbackModalProps) {
  const [actualEffort, setActualEffort] = useState('');
  const [deviationReason, setDeviationReason] = useState('');
  const [blockers, setBlockers] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');

  useEscapeKey(true, onClose);

  const canSubmit = actualEffort.trim() && deviationReason.trim();

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 modal-overlay-premium" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 20 }} 
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative modal-premium w-full max-w-lg p-8 shadow-2xl rounded-2xl border border-[var(--border-soft)] overflow-hidden"
      >
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 z-50" />
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center shadow-inner shrink-0">
              <Clock className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-text-primary">Completion Report</h3>
              <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest mt-1">Post-Execution Analytics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--pm-surface)]/5 text-text-quaternary hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-[var(--pm-surface-lowest)]/20 border border-[var(--border-soft)] p-4 rounded-xl mb-6 shadow-inner">
          <p className="text-sm font-bold text-text-primary">{task.name}</p>
          <div className="flex gap-4 mt-2">
            <p className="text-[10px] font-bold tracking-widest text-text-tertiary uppercase"><span className="text-text-secondary">Est:</span> {task.estimated_hours}h</p>
            <p className="text-[10px] font-bold tracking-widest text-text-tertiary uppercase"><span className="text-text-secondary">Pred:</span> {task.predicted_completion || 'N/A'}</p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-[11px] uppercase tracking-widest font-bold text-text-secondary flex items-center gap-2">
              <Clock className="w-3 h-3 text-cyan-400" />
              Actual Effort (hours) *
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={actualEffort}
              onChange={e => setActualEffort(e.target.value)}
              className="w-full input-premium h-11 px-4 text-sm outline-none"
              placeholder="Hours spent on this task"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] uppercase tracking-widest font-bold text-text-secondary flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-yellow-500" />
              Deviation Reason *
            </label>
            <select
              value={deviationReason}
              onChange={e => setDeviationReason(e.target.value)}
              className="w-full input-premium h-11 px-4 text-sm outline-none cursor-pointer"
            >
              <option value="">Select reason...</option>
              <option value="scope_creep">Scope Creep</option>
              <option value="underestimated">Underestimated Complexity</option>
              <option value="blockers">External Blockers</option>
              <option value="rework">Rework / Defects</option>
              <option value="accurate">On Target (No Deviation)</option>
              <option value="overestimated">Overestimated</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] uppercase tracking-widest font-bold text-text-secondary flex items-center gap-2">
              <Layers className="w-3 h-3 text-rose-400" />
              Blockers Encountered
            </label>
            <textarea
              value={blockers}
              onChange={e => setBlockers(e.target.value)}
              className="w-full input-premium h-24 p-3 text-sm outline-none resize-none"
              placeholder="What blocked progress on this task?"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] uppercase tracking-widest font-bold text-text-secondary flex items-center gap-2">
              <BookOpen className="w-3 h-3 text-blue-400" />
              Lessons Learned
            </label>
            <textarea
              value={lessonsLearned}
              onChange={e => setLessonsLearned(e.target.value)}
              className="w-full input-premium h-24 p-3 text-sm outline-none resize-none"
              placeholder="What could be improved for future tasks?"
            />
          </div>
        </div>

        <div className="flex gap-4 mt-8 pt-6 border-t border-[var(--border-soft)]">
          <button
            onClick={onSkip}
            className="flex-1 btn-premium-secondary h-12 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
          >
            Skip
          </button>
          <button
            onClick={() => canSubmit && onSubmit({ actual_effort: Number(actualEffort), deviation_reason: deviationReason, blockers, lessons_learned: lessonsLearned })}
            disabled={!canSubmit}
            className="flex-1 btn-premium-success h-12 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(52,211,153,0.15)]"
          >
            Submit Report
          </button>
        </div>
      </motion.div>
    </div>
  );
}

