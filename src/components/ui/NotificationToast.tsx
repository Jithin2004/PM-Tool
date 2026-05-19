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
    success: <CheckCircle2 className="w-4 h-4 text-green-400" />,
    error: <XCircle className="w-4 h-4 text-red-400" />,
    info: <Info className="w-4 h-4 text-blue-400" />,
    warning: <AlertCircle className="w-4 h-4 text-yellow-400" />
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, y: 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 bg-[#0c0c0c] border border-white/10 p-4 min-w-[300px] shadow-2xl"
    >
      {icons[notification.type]}
      <p className="text-xs font-mono text-white/80">{notification.message}</p>
      <button onClick={onClose} className="ml-auto text-white/75 hover:text-white transition-colors">
        <Plus className="w-4 h-4 rotate-45" />
      </button>
    </motion.div>
  );
}
