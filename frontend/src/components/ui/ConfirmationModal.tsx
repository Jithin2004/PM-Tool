import React from 'react';
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
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="absolute inset-0 bg-bg/80 backdrop-blur-md"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-surface/80 backdrop-blur-xl border border-border/50 p-6 sm:p-8 overflow-y-auto max-h-[90vh] md:max-h-none shadow-2xl shadow-black/50 rounded-2xl my-auto"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shadow-inner ${confirmText.toLowerCase() === 'delete' ? 'bg-red-500/10 border-red-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
              <AlertTriangle className={`w-6 h-6 ${confirmText.toLowerCase() === 'delete' ? 'text-red-400' : 'text-blue-400'}`} />
            </div>
            <h3 id="confirm-title" className="text-xl font-bold tracking-tight text-text-primary">{title}</h3>
          </div>
          <p className="text-sm text-text-secondary mb-8 leading-relaxed">
            {message}
          </p>
          <div className="flex gap-4">
            <button
              onClick={onConfirm}
              className={`flex-1 text-text-primary h-12 text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg ${confirmText.toLowerCase() === 'delete' ? 'bg-red-500 hover:bg-red-400 hover:shadow-red-500/25' : 'bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 hover:shadow-teal-500/25'}`}
            >
              {confirmText}
            </button>
            <button
              onClick={onCancel}
              className="flex-1 border border-border/50 text-text-secondary h-12 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-surface-3 hover:text-text-primary transition-all"
            >
              Abort
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
