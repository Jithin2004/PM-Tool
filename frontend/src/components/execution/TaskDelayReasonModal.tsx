import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, AlertTriangle } from 'lucide-react';
import type { Task } from '../../core/types/execution';

interface TaskDelayReasonModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

const VALID_REASONS = [
  'Requirement changed',
  'New learning',
  'External dependency',
  'Technical blocker',
  'Initial estimate wrong',
  'Execution delay'
];

export function TaskDelayReasonModal({ task, isOpen, onClose, onSubmit }: TaskDelayReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');

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
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Delivery Deviation
            </h2>
            <button onClick={onClose} className="p-1 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-3 transition-colors">
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

          <div className="p-4 border-t border-border bg-surface-2 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary">
              Cancel
            </button>
            <button
              disabled={!selectedReason}
              onClick={() => {
                onSubmit(selectedReason);
                onClose();
              }}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:hover:bg-amber-600 text-white rounded text-sm font-medium transition-colors"
            >
              Confirm Classification
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
