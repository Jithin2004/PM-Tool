import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ContextualHelpProps {
  topic: string;
  definition: string;
  calculation?: string;
  importance: string;
}

export function ContextualHelp({ topic, definition, calculation, importance }: ContextualHelpProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
      <HelpCircle className="w-3.5 h-3.5 text-text-quaternary hover:text-accent-primary cursor-pointer transition-colors" />
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-surface border border-border rounded-xl shadow-xl p-4 pointer-events-none"
          >
            <div className="text-[10px] font-bold text-accent-primary uppercase tracking-widest mb-2 border-b border-border-subtle pb-1">What is {topic}?</div>
            <div className="space-y-2 text-left">
              <div>
                <span className="text-[9px] font-bold text-text-secondary uppercase">Meaning</span>
                <p className="text-[11px] text-text-tertiary leading-snug">{definition}</p>
              </div>
              {calculation && (
                <div>
                  <span className="text-[9px] font-bold text-text-secondary uppercase">How it's calculated</span>
                  <p className="text-[11px] text-text-tertiary leading-snug">{calculation}</p>
                </div>
              )}
              <div>
                <span className="text-[9px] font-bold text-text-secondary uppercase">Why it matters</span>
                <p className="text-[11px] text-text-tertiary leading-snug">{importance}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

