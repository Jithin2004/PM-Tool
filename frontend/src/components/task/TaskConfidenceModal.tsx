import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, ShieldAlert } from 'lucide-react';
import { Task } from '../../types';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface TaskConfidenceModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (confidence: number, discoveryNotes?: string, estimatedEffortMinutes?: number) => void;
}

export function TaskConfidenceModal({ task, isOpen, onClose, onSubmit }: TaskConfidenceModalProps) {
  const [confidenceLevel, setConfidenceLevel] = useState<'high' | 'medium' | 'low' | null>(null);
  const [discoveryNotes, setDiscoveryNotes] = useState('');
  const [estimatedEffort, setEstimatedEffort] = useState(task ? (task.estimated_hours || 0) * 60 : 0);

  useEscapeKey(isOpen, onClose);

  useEffect(() => {
    if (task) {
      setConfidenceLevel(null);
      setDiscoveryNotes('');
      setEstimatedEffort((task.estimated_hours || 0) * 60);
    }
  }, [task]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confidenceLevel) return;
    
    const confidenceValue = confidenceLevel === 'high' ? 90 : confidenceLevel === 'medium' ? 50 : 20;
    if (confidenceLevel === 'low') {
      onSubmit(confidenceValue, discoveryNotes, estimatedEffort);
    } else {
      onSubmit(confidenceValue);
    }
  };

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
            <h3 className="text-sm font-semibold tracking-wide uppercase text-text-primary">Task Confidence Assessment</h3>
            <button
              onClick={onClose}
              className="p-1.5 text-text-quaternary hover:text-text-primary hover:bg-[var(--pm-surface)]/5 rounded-md transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="space-y-3">
              <label className="block text-xs font-medium text-text-secondary">
                How confident are you in the requirements and approach?
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setConfidenceLevel('high')}
                  className={`p-3 rounded-lg border text-center transition-all cursor-pointer ${
                    confidenceLevel === 'high' 
                      ? 'bg-signal-safe-bg border-signal-safe text-signal-safe font-semibold' 
                      : 'bg-[var(--pm-surface-lowest)]/20 border-[var(--border-soft)] text-text-secondary hover:border-signal-safe/50'
                  }`}
                >
                  <div className="text-sm font-semibold">High</div>
                  <div className="text-[10px] mt-1 opacity-80 font-mono">Clear path</div>
                </button>
                <button
                  type="button"
                  onClick={() => setConfidenceLevel('medium')}
                  className={`p-3 rounded-lg border text-center transition-all cursor-pointer ${
                    confidenceLevel === 'medium' 
                      ? 'bg-signal-warning-bg border-signal-warning text-signal-warning font-semibold' 
                      : 'bg-[var(--pm-surface-lowest)]/20 border-[var(--border-soft)] text-text-secondary hover:border-signal-warning/50'
                  }`}
                >
                  <div className="text-sm font-semibold">Medium</div>
                  <div className="text-[10px] mt-1 opacity-80 font-mono">Some unknowns</div>
                </button>
                <button
                  type="button"
                  onClick={() => setConfidenceLevel('low')}
                  className={`p-3 rounded-lg border text-center transition-all cursor-pointer ${
                    confidenceLevel === 'low' 
                      ? 'bg-signal-critical-bg border-signal-critical text-signal-critical font-semibold' 
                      : 'bg-[var(--pm-surface-lowest)]/20 border-[var(--border-soft)] text-text-secondary hover:border-signal-critical/50'
                  }`}
                >
                  <div className="text-sm font-semibold">Low</div>
                  <div className="text-[10px] mt-1 opacity-80 font-mono">Needs discovery</div>
                </button>
              </div>
            </div>

            {confidenceLevel === 'low' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4 p-4 bg-[var(--pm-surface-lowest)]/20 rounded-xl border border-[var(--border-soft)] animate-in fade-in"
              >
                <div className="flex items-center gap-2 text-signal-warning mb-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-semibold">Discovery Mode Activated</span>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                    What research or clarification is needed?
                  </label>
                  <textarea
                    required
                    value={discoveryNotes}
                    onChange={(e) => setDiscoveryNotes(e.target.value)}
                    className="w-full input-premium p-4 text-sm outline-none resize-none min-h-[80px]"
                    placeholder="Describe the unknowns, missing requirements, or technical risks..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                    Revised Estimated Effort (Minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={estimatedEffort}
                    onChange={(e) => setEstimatedEffort(parseInt(e.target.value) || 0)}
                    className="w-full input-premium h-11 px-4 text-sm outline-none"
                  />
                </div>
              </motion.div>
            )}

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
                disabled={!confidenceLevel}
                className="btn-premium-primary flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Start Task
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
