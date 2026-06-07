import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { Task } from '../../types';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface TaskReviewModalProps {
  task: Task;
  actionType: 'completed' | 'changes_requested';
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (notes: string) => void;
}

export function TaskReviewModal({ task, actionType, isOpen, onClose, onSubmit }: TaskReviewModalProps) {
  const [notes, setNotes] = useState('');

  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (actionType === 'changes_requested' && !notes.trim()) return;
    onSubmit(notes);
  };

  const isApprove = actionType === 'completed';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay-premium">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="modal-premium relative w-full max-w-lg rounded-2xl border border-[var(--border-soft)] shadow-2xl overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between p-6 border-b border-[var(--border-soft)]">
            <div className={`flex items-center gap-2 ${isApprove ? 'text-signal-safe' : 'text-signal-warning'}`}>
              {isApprove ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-amber-500" />}
              <h3 className="text-sm font-semibold tracking-wide uppercase text-text-primary">
                {isApprove ? 'Approve Task Completion' : 'Request Changes'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-text-quaternary hover:text-text-primary hover:bg-[var(--pm-surface)]/5 rounded-md transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            
            <div className="bg-[var(--pm-surface-lowest)]/20 border border-[var(--border-soft)] rounded-xl p-4 mb-4">
              <h4 className="text-xs font-semibold text-text-primary mb-2">Task Execution Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-[11px]">
                <div>
                  <span className="text-text-secondary block">Original Estimate</span>
                  <span className="text-text-primary font-mono">{task.estimated_hours}h</span>
                </div>
                <div>
                  <span className="text-text-secondary block">Actual Time Spent</span>
                  <span className="text-text-primary font-mono">
                    {task.actual_effort_minutes ? (task.actual_effort_minutes / 60).toFixed(1) : 0}h
                  </span>
                </div>
                {task.discovery_notes && (
                  <div className="col-span-2">
                    <span className="text-text-secondary block mb-1">Discovery Notes</span>
                    <p className="text-text-primary bg-[var(--pm-bg)] p-3 rounded-lg border border-[var(--border-soft)] italic text-[11px]">
                      {task.discovery_notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                {isApprove ? 'Approval Notes (Optional)' : 'What changes are required?'}
              </label>
              <textarea
                required={!isApprove}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full input-premium p-4 text-sm outline-none resize-none min-h-[100px]"
                placeholder={isApprove ? 'Add any final thoughts or feedback...' : 'Describe what needs to be fixed...'}
              />
            </div>

            <div className="flex justify-end gap-3 pt-5 border-t border-[var(--border-soft)]">
              <button
                type="button"
                onClick={onClose}
                className="btn-premium-secondary px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isApprove && !notes.trim()}
                className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all disabled:opacity-50 cursor-pointer ${
                  isApprove ? 'btn-premium-success' : 'btn-premium-danger'
                }`}
              >
                <Save className="w-4 h-4" />
                {isApprove ? 'Approve & Complete' : 'Request Changes'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
