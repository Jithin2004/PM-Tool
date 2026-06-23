import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, Link as LinkIcon, FileText, Github, AlertCircle } from 'lucide-react';
import type { Task } from '../../core/types/execution';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface TaskEvidenceModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (evidence: {
    summary: string;
    link: string;
    pr_url: string;
  }) => void;
}

export function TaskEvidenceModal({ task, isOpen, onClose, onSubmit }: TaskEvidenceModalProps) {
  const [summary, setSummary] = useState('');
  const [link, setLink] = useState('');
  const [prUrl, setPrUrl] = useState('');

  useEscapeKey(isOpen, onClose);

  // Early return must be after ALL hooks are defined (Rules of Hooks)
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay-premium">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="modal-premium w-full max-w-md rounded-2xl overflow-hidden flex flex-col shadow-2xl relative border border-[var(--border-soft)]"
        >
          <div className="flex items-center justify-between p-6 border-b border-[var(--border-soft)]">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-text-primary tracking-tight">
              <CheckCircle2 className="w-5 h-5 text-indigo-400" />
              Submit for Review
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-3 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex gap-3 text-sm text-indigo-200">
              <AlertCircle className="w-5 h-5 text-indigo-400 shrink-0" />
              <p className="text-xs">Please provide evidence of completion to help the reviewer understand what was delivered.</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent-primary" /> Implementation Summary
              </label>
              <textarea
                value={summary}
                onChange={e => setSummary(e.target.value)}
                placeholder="Briefly describe what was implemented or changed..."
                className="input-premium w-full h-24 p-3 text-sm outline-none resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-accent-primary" /> Document / Design Link (Optional)
              </label>
              <input
                type="text"
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder="https://..."
                className="input-premium w-full h-11 px-4 text-sm outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2">
                <Github className="w-4 h-4 text-accent-primary" /> PR / Commit URL (Optional)
              </label>
              <input
                type="text"
                value={prUrl}
                onChange={e => setPrUrl(e.target.value)}
                placeholder="https://github.com/..."
                className="input-premium w-full h-11 px-4 text-sm outline-none"
              />
            </div>
          </div>

          <div className="p-5 border-t border-[var(--border-soft)] bg-[var(--pm-surface-lowest)]/30 flex justify-end gap-3">
            <button onClick={onClose} className="btn-premium-secondary px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all">
              Cancel
            </button>
            <button
              onClick={() => {
                onSubmit({ summary, link, pr_url: prUrl });
                onClose();
              }}
              className="btn-premium-primary px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            >
              Move to Review
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

