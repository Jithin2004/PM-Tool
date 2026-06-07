import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({ isOpen, title, message, confirmText = 'Confirm', onConfirm, onCancel }: ConfirmationModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const isDelete = confirmText.toLowerCase() === 'delete' || confirmText.toLowerCase() === 'remove';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="absolute inset-0 modal-overlay-premium"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md modal-premium p-6 sm:p-8 overflow-y-auto max-h-[90vh] md:max-h-none rounded-2xl my-auto"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shadow-inner ${isDelete ? 'bg-rose-500/10 border-rose-500/20' : 'bg-purple-500/10 border-purple-500/20'}`}>
              <AlertTriangle className={`w-6 h-6 ${isDelete ? 'text-rose-400' : 'text-purple-400'}`} />
            </div>
            <h3 id="confirm-title" className="text-xl font-bold tracking-tight text-white">{title}</h3>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mb-8 leading-relaxed">
            {message}
          </p>
          <div className="flex gap-4">
            <button
              onClick={onConfirm}
              className={`flex-1 h-12 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${isDelete ? 'btn-premium-danger' : 'btn-premium-primary'}`}
            >
              {confirmText}
            </button>
            <button
              onClick={onCancel}
              className="flex-1 btn-premium-secondary h-12 text-xs font-bold uppercase tracking-wider rounded-xl"
            >
              Abort
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
