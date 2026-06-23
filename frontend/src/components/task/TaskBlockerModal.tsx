import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, AlertTriangle } from 'lucide-react';
import { Task } from '../../types';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface TaskBlockerModalProps {
  task: Task;
  users: any[];
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (blockedReason: string, needsHelpFrom?: string) => void;
}

export function TaskBlockerModal({ task, users, isOpen, onClose, onSubmit }: TaskBlockerModalProps) {
  const [blockedReason, setBlockedReason] = useState('');
  const [needsHelpFrom, setNeedsHelpFrom] = useState('');

  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockedReason.trim()) return;
    onSubmit(blockedReason, needsHelpFrom || undefined);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay-premium">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="modal-premium relative w-full max-w-md rounded-2xl overflow-hidden border border-[var(--border-soft)] shadow-2xl"
        >
          <div className="flex items-center justify-between p-6 border-b border-[var(--border-soft)]">
            <div className="flex items-center gap-2 text-signal-critical">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
              <h3 className="text-sm font-semibold tracking-wide uppercase text-text-primary">Report Blocker</h3>
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
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                Why is this task blocked?
              </label>
              <textarea
                required
                value={blockedReason}
                onChange={(e) => setBlockedReason(e.target.value)}
                className="w-full input-premium p-4 text-sm outline-none resize-none min-h-[100px]"
                placeholder="Describe what is preventing progress..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                Who do you need help from? (Optional)
              </label>
              <select
                value={needsHelpFrom}
                onChange={(e) => setNeedsHelpFrom(e.target.value)}
                className="w-full input-premium h-11 px-4 text-sm outline-none cursor-pointer"
              >
                <option value="">Anyone / Not sure</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-5 border-t border-[var(--border-soft)]">
              <button
                type="button"
                onClick={onClose}
                className="btn-premium-secondary px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!blockedReason.trim()}
                className="btn-premium-danger flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Mark as Blocked
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

