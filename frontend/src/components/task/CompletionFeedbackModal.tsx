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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative bg-[#0c0c0c] border border-white/10 w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold tracking-tight uppercase">Task Completion Report</h3>
          </div>
          <button onClick={onClose} className="p-1 border border-white/10 hover:bg-white/5 transition-colors">
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>

        <div className="bg-white/5 border border-white/10 p-3 mb-6">
          <p className="text-xs font-semibold text-white/90">{task.name}</p>
          <p className="text-[9px] font-mono text-white/50 mt-1">Estimated: {task.estimated_hours}h | Predicted: {task.predicted_completion || 'N/A'}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-mono text-white/70 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-cyan-400" />
              Actual Effort (hours) *
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={actualEffort}
              onChange={e => setActualEffort(e.target.value)}
              className="w-full bg-black border border-white/10 h-10 px-3 font-mono text-sm focus:border-white/40 outline-none"
              placeholder="Hours spent on this task"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-mono text-white/70 mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              Deviation Reason *
            </label>
            <select
              value={deviationReason}
              onChange={e => setDeviationReason(e.target.value)}
              className="w-full bg-black border border-white/10 h-10 px-3 font-mono text-sm focus:border-white/40 outline-none appearance-none"
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
            <label className="block text-[10px] uppercase font-mono text-white/70 mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-rose-400" />
              Blockers Encountered
            </label>
            <textarea
              value={blockers}
              onChange={e => setBlockers(e.target.value)}
              className="w-full bg-black border border-white/10 h-20 px-3 py-2 font-mono text-xs focus:border-white/40 outline-none resize-none"
              placeholder="What blocked progress on this task?"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-mono text-white/70 mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3 h-3 text-purple-400" />
              Lessons Learned
            </label>
            <textarea
              value={lessonsLearned}
              onChange={e => setLessonsLearned(e.target.value)}
              className="w-full bg-black border border-white/10 h-20 px-3 py-2 font-mono text-xs focus:border-white/40 outline-none resize-none"
              placeholder="What could be improved for future tasks?"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-white/10">
          <button
            onClick={() => canSubmit && onSubmit({ actual_effort: Number(actualEffort), deviation_reason: deviationReason, blockers, lessons_learned: lessonsLearned })}
            disabled={!canSubmit}
            className={`flex-1 h-10 text-[10px] uppercase font-mono tracking-widest transition-colors ${canSubmit ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-white/5 text-white/30 cursor-not-allowed'}`}
          >
            Submit Report
          </button>
          <button
            onClick={onSkip}
            className="flex-1 h-10 border border-white/10 text-[10px] uppercase font-mono tracking-widest hover:bg-white/5 transition-colors"
          >
            Skip
          </button>
        </div>
      </motion.div>
    </div>
  );
}
