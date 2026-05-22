import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { slideUp } from '../../lib/animation';

export function ReconnectionBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onOffline = () => setShow(true);
    const onOnline = () => {
      setShow(true);
      setTimeout(() => setShow(false), 2000);
    };

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          variants={slideUp}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="fixed top-0 left-0 right-0 z-[300] flex justify-center"
        >
          <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2 backdrop-blur-sm">
            <span className="text-[11px] font-mono text-amber-400/70">
              {navigator.onLine ? 'Reconnected' : 'Connection lost — reconnecting...'}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
