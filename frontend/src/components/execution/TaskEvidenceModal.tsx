import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Link as LinkIcon, FileText, Github, AlertCircle } from 'lucide-react';
import type { Task } from '../../core/types/execution';

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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-surface border border-border rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between p-4 border-b border-border bg-surface-2">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-text-primary tracking-tight">
              <CheckCircle2 className="w-5 h-5 text-indigo-400" />
              Submit for Review
            </h2>
            <button onClick={onClose} className="p-1 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-3 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex gap-3 text-sm text-indigo-200">
              <AlertCircle className="w-5 h-5 text-indigo-400 shrink-0" />
              <p>Please provide evidence of completion to help the reviewer understand what was delivered.</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Implementation Summary
              </label>
              <textarea
                value={summary}
                onChange={e => setSummary(e.target.value)}
                placeholder="Briefly describe what was implemented or changed..."
                className="w-full h-24 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-2">
                <LinkIcon className="w-4 h-4" /> Document / Design Link (Optional)
              </label>
              <input
                type="text"
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder="https://..."
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-2">
                <Github className="w-4 h-4" /> PR / Commit URL (Optional)
              </label>
              <input
                type="text"
                value={prUrl}
                onChange={e => setPrUrl(e.target.value)}
                placeholder="https://github.com/..."
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="p-4 border-t border-border bg-surface-2 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary">
              Cancel
            </button>
            <button
              onClick={() => {
                onSubmit({ summary, link, pr_url: prUrl });
                onClose();
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium transition-colors"
            >
              Move to Review
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
