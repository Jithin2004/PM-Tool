import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Clock } from 'lucide-react';
import { workSessionService } from '../../services/workSessionService';

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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-surface border border-border rounded-lg shadow-xl w-full max-w-md overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-500" />
              Log Manual Time
            </h2>
            <button onClick={onClose} className="p-1 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-2">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Task</label>
              <div className="text-sm font-medium p-2 bg-surface-2 rounded border border-border">
                {task.name}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Start Time</label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">End Time</label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Reason (Required)</label>
              <textarea
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why was the timer not used? (e.g. Forgot to start timer, Offline work)"
                className="w-full bg-surface-2 border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500 min-h-[80px]"
              />
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium flex items-center gap-2 disabled:opacity-50"
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
