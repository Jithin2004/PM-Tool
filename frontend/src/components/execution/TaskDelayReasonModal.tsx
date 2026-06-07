import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, AlertTriangle } from 'lucide-react';
import type { Task } from '../../core/types/execution';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface TaskDelayReasonModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

const VALID_REASONS = [
  'Requirement changed',
  'Technical blocker',
  'External dependency',
  'Learning curve',
  'Wrong initial estimate',
  'Unexpected complexity',
  'Other'
];

export function TaskDelayReasonModal({ task, isOpen, onClose, onSubmit }: TaskDelayReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');

  useEscapeKey(isOpen, onClose);

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
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Delivery Deviation
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
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-3 text-sm text-amber-200">
              <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-400">Execution time exceeded estimate.</p>
                <p className="mt-1 text-amber-200/80 text-xs">
                  This task took longer than originally estimated ({task.actual_effort_minutes}m actual vs {task.estimated_effort_minutes}m est). 
                  Please classify the delay factor. Only execution patterns will affect future predictions.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">
                Select Delay Factor
              </label>
              <div className="space-y-2">
                {VALID_REASONS.map(reason => (
                  <button
                    key={reason}
                    onClick={() => setSelectedReason(reason)}
                    className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                      selectedReason === reason 
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-medium' 
                        : 'bg-surface-2 border-border text-text-secondary hover:bg-surface-3 hover:text-text-primary'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-[var(--border-soft)] bg-[var(--pm-surface-lowest)]/30 flex justify-end gap-3">
            <button onClick={onClose} className="btn-premium-secondary px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all">
              Cancel
            </button>
            <button
              disabled={!selectedReason}
              onClick={() => {
                onSubmit(selectedReason);
                onClose();
              }}
              className="btn-premium-primary px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
            >
              Confirm Classification
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
