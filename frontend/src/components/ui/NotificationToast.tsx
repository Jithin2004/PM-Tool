import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Info, AlertCircle, Plus } from 'lucide-react';

export interface Notification {
  id?: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export function NotificationToast({ notification, onClose }: { notification: Notification; onClose: () => void; key?: string }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-signal-safe" />,
    error: <XCircle className="w-4 h-4 text-signal-critical" />,
    info: <Info className="w-4 h-4 text-signal-info" />,
    warning: <AlertCircle className="w-4 h-4 text-signal-warning" />
  };

  return (
    <motion.div
      role="alert"
      aria-live="assertive"
      initial={{ opacity: 0, x: 20, y: 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 bg-surface border border-border p-4 min-w-[300px] shadow-2xl"
    >
      {icons[notification.type]}
      <p className="text-xs font-mono text-text-secondary">{notification.message}</p>
      <button onClick={onClose} className="ml-auto text-text-secondary hover:text-text-primary transition-colors">
        <Plus className="w-4 h-4 rotate-45" />
      </button>
    </motion.div>
  );
}
