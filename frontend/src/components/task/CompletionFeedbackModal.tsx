import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, AlertTriangle, Clock, BookOpen, Layers } from 'lucide-react';
import type { Task } from '../../types';

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

  const canSubmit = actualEffort.trim() && deviationReason.trim();

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-bg/80 backdrop-blur-md" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 20 }} 
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative bg-surface/80 backdrop-blur-xl border border-border/50 w-full max-w-lg p-8 shadow-2xl shadow-black/50 rounded-2xl"
      >
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 rounded-t-2xl z-50" />
        
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
          <button onClick={onClose} className="p-2 border border-border/50 rounded-xl hover:bg-surface-3 transition-colors text-text-secondary hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-surface-3/50 border border-border/50 p-4 rounded-xl mb-6 shadow-inner">
          <p className="text-sm font-bold text-text-primary">{task.name}</p>
          <div className="flex gap-4 mt-2">
            <p className="text-[10px] font-bold tracking-widest text-text-tertiary uppercase"><span className="text-text-secondary">Est:</span> {task.estimated_hours}h</p>
            <p className="text-[10px] font-bold tracking-widest text-text-tertiary uppercase"><span className="text-text-secondary">Pred:</span> {task.predicted_completion || 'N/A'}</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-[11px] uppercase tracking-widest font-bold text-text-secondary mb-2 flex items-center gap-2">
              <Clock className="w-3 h-3 text-cyan-400" />
              Actual Effort (hours) *
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={actualEffort}
              onChange={e => setActualEffort(e.target.value)}
              className="w-full bg-surface-3/50 border border-border/50 h-12 px-4 rounded-xl text-sm focus:border-teal-500/50 outline-none text-text-primary transition-all"
              placeholder="Hours spent on this task"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-widest font-bold text-text-secondary mb-2 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-yellow-500" />
              Deviation Reason *
            </label>
            <select
              value={deviationReason}
              onChange={e => setDeviationReason(e.target.value)}
              className="w-full bg-surface-3/50 border border-border/50 h-12 px-4 rounded-xl text-xs focus:border-teal-500/50 outline-none hover:bg-surface-3 transition-colors cursor-pointer appearance-none text-text-primary"
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

          <div>
            <label className="block text-[11px] uppercase tracking-widest font-bold text-text-secondary mb-2 flex items-center gap-2">
              <Layers className="w-3 h-3 text-rose-400" />
              Blockers Encountered
            </label>
            <textarea
              value={blockers}
              onChange={e => setBlockers(e.target.value)}
              className="w-full bg-surface-3/50 border border-border/50 h-24 px-4 py-3 rounded-xl text-sm focus:border-teal-500/50 outline-none text-text-primary transition-all resize-none"
              placeholder="What blocked progress on this task?"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-widest font-bold text-text-secondary mb-2 flex items-center gap-2">
              <BookOpen className="w-3 h-3 text-blue-400" />
              Lessons Learned
            </label>
            <textarea
              value={lessonsLearned}
              onChange={e => setLessonsLearned(e.target.value)}
              className="w-full bg-surface-3/50 border border-border/50 h-24 px-4 py-3 rounded-xl text-sm focus:border-teal-500/50 outline-none text-text-primary transition-all resize-none"
              placeholder="What could be improved for future tasks?"
            />
          </div>
        </div>

        <div className="flex gap-4 mt-8 pt-6 border-t border-border/50">
          <button
            onClick={() => canSubmit && onSubmit({ actual_effort: Number(actualEffort), deviation_reason: deviationReason, blockers, lessons_learned: lessonsLearned })}
            disabled={!canSubmit}
            className={`flex-1 h-12 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg ${canSubmit ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-[var(--pm-text)] dark:text-white hover:from-emerald-500 hover:to-teal-400 hover:shadow-emerald-500/25' : 'bg-surface-3/50 border border-border/50 text-text-quaternary cursor-not-allowed shadow-none'}`}
          >
            Submit Report
          </button>
          <button
            onClick={onSkip}
            className="flex-1 h-12 rounded-xl border border-border/50 text-text-secondary text-xs font-bold uppercase tracking-wider hover:bg-surface-3 hover:text-text-primary transition-all"
          >
            Skip
          </button>
        </div>
      </motion.div>
    </div>
  );
}
