import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertTriangle } from 'lucide-react';
import { Task } from '../../types';

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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockedReason.trim()) return;
    onSubmit(blockedReason, needsHelpFrom || undefined);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-md bg-surface border border-border shadow-2xl rounded-xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-border bg-surface-2">
            <div className="flex items-center gap-2 text-signal-critical">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-semibold">Report Blocker</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-text-quaternary hover:text-text-primary hover:bg-surface-3 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Why is this task blocked?
              </label>
              <textarea
                required
                value={blockedReason}
                onChange={(e) => setBlockedReason(e.target.value)}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary min-h-[100px]"
                placeholder="Describe what is preventing progress..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Who do you need help from? (Optional)
              </label>
              <select
                value={needsHelpFrom}
                onChange={(e) => setNeedsHelpFrom(e.target.value)}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
              >
                <option value="">Anyone / Not sure</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                ))}
              </select>
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
                disabled={!blockedReason.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-signal-critical text-white text-sm font-medium rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
