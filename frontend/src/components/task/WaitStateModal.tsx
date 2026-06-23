import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Clock, AlertCircle } from 'lucide-react';
import { Task } from '../../types';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface WaitStateModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onSubmit: (waitStateData: { reason: string; owner: string; notes: string }) => Promise<void>;
  notify: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export function WaitStateModal({ isOpen, onClose, task, onSubmit, notify }: WaitStateModalProps) {
  const [reason, setReason] = useState('');
  const [owner, setOwner] = useState('internal');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      notify("Please select a reason for the delay.", "error");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit({ reason, owner, notes });
      notify("Wait state logged successfully.", "success");
      onClose();
    } catch (err: any) {
      notify(`Failed to log wait state: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 modal-overlay-premium z-[99999] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="modal-premium p-8 rounded-2xl w-full max-w-md relative overflow-hidden shadow-2xl border border-[var(--border-soft)]"
      >
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500" />
        
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-semibold tracking-wide uppercase text-text-primary flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
            Log Delay / Wait State
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--pm-surface)]/5 text-text-quaternary hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
              Why is work paused? <span className="text-signal-error">*</span>
            </label>
            <select
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full input-premium h-11 px-4 text-sm outline-none cursor-pointer"
            >
              <option value="">-- Select Reason --</option>
              <option value="WAITING_FOR_CLIENT">Waiting on Client</option>
              <option value="WAITING_FOR_APPROVAL">Waiting on Approval</option>
              <option value="WAITING_FOR_VENDOR">Waiting on Vendor</option>
              <option value="WAITING_FOR_INFRASTRUCTURE">Waiting on Infrastructure</option>
              <option value="WAITING_FOR_COMPLIANCE">Waiting on Compliance</option>
              <option value="BLOCKED_DEPENDENCY">Internal Team Blocker</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
              Who owns this delay?
            </label>
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="w-full input-premium h-11 px-4 text-sm outline-none cursor-pointer"
            >
              <option value="internal_team">Internal</option>
              <option value="client">Client</option>
              <option value="vendor">Vendor</option>
              <option value="compliance">Compliance</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide more details about this blocker..."
              rows={3}
              className="w-full input-premium p-4 text-sm outline-none resize-none"
            />
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
              Logging a wait state pauses SLAs and recalculates project ETAs. Ensure the owner is accurately assigned.
            </p>
          </div>

          <div className="pt-6 mt-4 flex justify-end gap-3 border-t border-[var(--border-soft)]">
            <button
              type="button"
              onClick={onClose}
              className="btn-premium-secondary px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-premium-primary px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(124,58,237,0.2)]"
            >
              {isSubmitting ? 'Processing...' : 'Create Wait State'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

