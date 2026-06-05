import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Task } from '../../types';

interface TaskConfidenceModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (confidence: number, discoveryNotes?: string, estimatedEffortMinutes?: number) => void;
}

export function TaskConfidenceModal({ task, isOpen, onClose, onSubmit }: TaskConfidenceModalProps) {
  const [confidenceLevel, setConfidenceLevel] = useState<'high' | 'medium' | 'low' | null>(null);
  const [discoveryNotes, setDiscoveryNotes] = useState('');
  const [estimatedEffort, setEstimatedEffort] = useState(task.estimated_hours * 60 || 0);

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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg bg-surface border border-border shadow-2xl rounded-xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-border bg-surface-2">
            <h3 className="text-sm font-semibold text-text-primary">Task Confidence Assessment</h3>
            <button
              onClick={onClose}
              className="p-1.5 text-text-quaternary hover:text-text-primary hover:bg-surface-3 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">
                How confident are you in the requirements and approach?
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setConfidenceLevel('high')}
                  className={`p-3 rounded border text-center transition-all ${
                    confidenceLevel === 'high' 
                      ? 'bg-signal-safe-bg border-signal-safe text-signal-safe' 
                      : 'bg-surface-2 border-border text-text-secondary hover:border-signal-safe/50'
                  }`}
                >
                  <div className="text-sm font-semibold">High</div>
                  <div className="text-[10px] mt-1 opacity-80">Clear path</div>
                </button>
                <button
                  type="button"
                  onClick={() => setConfidenceLevel('medium')}
                  className={`p-3 rounded border text-center transition-all ${
                    confidenceLevel === 'medium' 
                      ? 'bg-signal-warning-bg border-signal-warning text-signal-warning' 
                      : 'bg-surface-2 border-border text-text-secondary hover:border-signal-warning/50'
                  }`}
                >
                  <div className="text-sm font-semibold">Medium</div>
                  <div className="text-[10px] mt-1 opacity-80">Some unknowns</div>
                </button>
                <button
                  type="button"
                  onClick={() => setConfidenceLevel('low')}
                  className={`p-3 rounded border text-center transition-all ${
                    confidenceLevel === 'low' 
                      ? 'bg-signal-critical-bg border-signal-critical text-signal-critical' 
                      : 'bg-surface-2 border-border text-text-secondary hover:border-signal-critical/50'
                  }`}
                >
                  <div className="text-sm font-semibold">Low</div>
                  <div className="text-[10px] mt-1 opacity-80">Needs discovery</div>
                </button>
              </div>
            </div>

            {confidenceLevel === 'low' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4 p-4 bg-surface-2 rounded-lg border border-border"
              >
                <div className="flex items-center gap-2 text-signal-warning mb-2">
                  <ShieldAlert className="w-4 h-4" />
                  <span className="text-xs font-semibold">Discovery Mode Activated</span>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">
                    What research or clarification is needed?
                  </label>
                  <textarea
                    required
                    value={discoveryNotes}
                    onChange={(e) => setDiscoveryNotes(e.target.value)}
                    className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary min-h-[80px]"
                    placeholder="Describe the unknowns, missing requirements, or technical risks..."
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">
                    Revised Estimated Effort (Minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={estimatedEffort}
                    onChange={(e) => setEstimatedEffort(parseInt(e.target.value) || 0)}
                    className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                  />
                </div>
              </motion.div>
            )}

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
                disabled={!confidenceLevel}
                className="flex items-center gap-2 px-4 py-2 bg-accent-primary text-white text-sm font-medium rounded hover:bg-accent-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
