import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  isCritical?: boolean;
}

export function PremiumModal({ isOpen, onClose, title, children, maxWidth = 'md', isCritical = false }: PremiumModalProps) {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={isCritical ? undefined : onClose}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={`relative w-full ${maxWidthClasses[maxWidth]} bg-[var(--surface-glass)] backdrop-blur-xl border border-[var(--border-strong)] rounded-2xl shadow-[var(--premium-shadow)] overflow-hidden flex flex-col max-h-[90vh]`}
          >
            {title && (
              <div className="flex items-center justify-between p-5 border-b border-[var(--border-soft)] shrink-0">
                <h2 className="text-base font-semibold text-[var(--text-primary)] tracking-tight font-geist">{title}</h2>
                <button 
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors interactive-premium"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="p-5 overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
