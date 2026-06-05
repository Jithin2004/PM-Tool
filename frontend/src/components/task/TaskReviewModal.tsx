import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { Task } from '../../types';

interface TaskReviewModalProps {
  task: Task;
  actionType: 'completed' | 'changes_requested';
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (notes: string) => void;
}

export function TaskReviewModal({ task, actionType, isOpen, onClose, onSubmit }: TaskReviewModalProps) {
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (actionType === 'changes_requested' && !notes.trim()) return;
    onSubmit(notes);
  };

  const isApprove = actionType === 'completed';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg bg-surface border border-border shadow-2xl rounded-xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-border bg-surface-2">
            <div className={`flex items-center gap-2 ${isApprove ? 'text-signal-safe' : 'text-signal-warning'}`}>
              {isApprove ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <h3 className="text-sm font-semibold">
                {isApprove ? 'Approve Task Completion' : 'Request Changes'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-text-quaternary hover:text-text-primary hover:bg-surface-3 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            
            <div className="bg-surface-2 border border-border rounded-lg p-4 mb-4">
              <h4 className="text-xs font-semibold text-text-primary mb-2">Task Execution Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-[11px]">
                <div>
                  <span className="text-text-secondary block">Original Estimate</span>
                  <span className="text-text-primary font-mono-pm">{task.estimated_hours}h</span>
                </div>
                <div>
                  <span className="text-text-secondary block">Actual Time Spent</span>
                  <span className="text-text-primary font-mono-pm">
                    {task.actual_effort_minutes ? (task.actual_effort_minutes / 60).toFixed(1) : 0}h
                  </span>
                </div>
                {task.discovery_notes && (
                  <div className="col-span-2">
                    <span className="text-text-secondary block mb-1">Discovery Notes</span>
                    <p className="text-text-primary bg-surface p-2 rounded border border-border italic">
                      {task.discovery_notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                {isApprove ? 'Approval Notes (Optional)' : 'What changes are required?'}
              </label>
              <textarea
                required={!isApprove}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary min-h-[100px]"
                placeholder={isApprove ? 'Add any final thoughts or feedback...' : 'Describe what needs to be fixed...'}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isApprove && !notes.trim()}
                className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isApprove ? 'bg-signal-safe hover:bg-green-600' : 'bg-signal-warning hover:bg-amber-600'
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
