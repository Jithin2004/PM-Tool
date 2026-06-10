import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ContextHelpProps {
  text: string;
}

export function ContextHelp({ text }: ContextHelpProps) {
  const [show, setShow] = useState(false);

  return (
    <div 
      className="relative inline-flex items-center justify-center ml-1"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <HelpCircle className="w-3.5 h-3.5 text-[var(--pm-text-tertiary)] hover:text-indigo-400 transition-colors cursor-help" />
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[#1c1d1f] border border-[var(--pm-border)] rounded shadow-xl z-50 text-[11px] text-[var(--pm-text-secondary)] leading-relaxed pointer-events-none text-center font-geist"
          >
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-[var(--pm-border)]" />
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[2px] border-4 border-transparent border-t-[#1c1d1f]" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
