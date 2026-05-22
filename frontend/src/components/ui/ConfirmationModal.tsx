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
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-[#0c0c0c] border border-white/10 p-6 sm:p-8 overflow-y-auto max-h-[90vh] md:max-h-none shadow-2xl rounded-sm my-auto"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-10 h-10 rounded-sm border flex items-center justify-center ${confirmText.toLowerCase() === 'delete' ? 'bg-red-500/10 border-red-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
              <AlertTriangle className={`w-5 h-5 ${confirmText.toLowerCase() === 'delete' ? 'text-red-500' : 'text-blue-500'}`} />
            </div>
            <h3 id="confirm-title" className="text-xl font-medium tracking-tight uppercase">{title}</h3>
          </div>
          <p className="text-sm font-mono text-white/85 mb-8 leading-relaxed">
            {message}
          </p>
          <div className="flex gap-4">
            <button
              onClick={onConfirm}
              className={`flex-1 text-white h-12 text-xs font-semibold uppercase tracking-widest transition-colors ${confirmText.toLowerCase() === 'delete' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
            >
              {confirmText}
            </button>
            <button
              onClick={onCancel}
              className="flex-1 border border-white/10 text-white/85 h-12 text-xs font-semibold uppercase tracking-widest hover:bg-white/5 transition-colors"
            >
              Abort
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
