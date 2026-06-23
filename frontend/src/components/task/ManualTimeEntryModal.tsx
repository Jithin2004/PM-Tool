import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Clock } from 'lucide-react';
import { workSessionService } from '../../services/workSessionService';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface ManualTimeEntryModalProps {
  task: any;
  workspaceId: string;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  notify: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export function ManualTimeEntryModal({ task, workspaceId, userId, isOpen, onClose, onSuccess, notify }: ManualTimeEntryModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEscapeKey(isOpen, onClose);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      notify('Please provide a reason for the manual entry.', 'error');
      return;
    }

    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);

    if (endDateTime <= startDateTime) {
      notify('End time must be after start time.', 'error');
      return;
    }

    setLoading(true);
    const { success, requiresApproval } = await workSessionService.addManualSession(
      workspaceId,
      task.id,
      userId,
      startDateTime,
      endDateTime,
      reason
    );
    setLoading(false);

    if (success) {
      if (requiresApproval) {
        notify('Manual entry over 2 hours requires PM approval. Request submitted.', 'info');
      } else {
        notify('Manual time entry logged successfully.', 'success');
      }
      onSuccess();
      onClose();
    } else {
      notify('Failed to log manual time entry.', 'error');
    }
  };

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
              <Clock className="w-5 h-5 text-accent-primary" />
              Log Manual Time
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-3 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary">Task</label>
              <div className="text-sm font-medium p-3 bg-[var(--pm-surface-lowest)]/20 rounded-lg border border-[var(--border-soft)] text-text-primary">
                {task.name}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-premium w-full h-11 px-4 text-sm outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary">Start Time</label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="input-premium w-full h-11 px-4 text-sm outline-none cursor-pointer"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary">End Time</label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="input-premium w-full h-11 px-4 text-sm outline-none cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary">Reason (Required)</label>
              <textarea
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why was the timer not used? (e.g. Forgot to start timer, Offline work)"
                className="input-premium w-full p-4 text-sm outline-none resize-none min-h-[90px]"
              />
            </div>

            <div className="pt-5 flex justify-end gap-3 border-t border-[var(--border-soft)]">
              <button
                type="button"
                onClick={onClose}
                className="btn-premium-secondary px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-premium-primary px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Saving...' : 'Save Time Entry'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

