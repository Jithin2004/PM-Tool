import React, { useState } from 'react';
import { PriorityExplanation } from '../../core/intelligence/PriorityExplanationEngine';
import { motion, AnimatePresence } from 'motion/react';
import { Info, AlertCircle, AlertTriangle } from 'lucide-react';

interface PriorityExplanationBadgeProps {
  explanation: PriorityExplanation;
  className?: string;
}

export function PriorityExplanationBadge({ explanation, className = '' }: PriorityExplanationBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const colors = {
    critical: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    high: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    medium: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    low: 'bg-surface-3 text-text-secondary border-border'
  };

  const icons = {
    critical: <AlertCircle className="w-3.5 h-3.5" />,
    high: <AlertTriangle className="w-3.5 h-3.5" />,
    medium: <Info className="w-3.5 h-3.5" />,
    low: null
  };

  const primaryReason = explanation.reasons[0] || 'Standard priority';
  const labelText = explanation.impactLevel.charAt(0).toUpperCase() + explanation.impactLevel.slice(1);

  return (
    <div 
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono tracking-wide border cursor-help ${colors[explanation.impactLevel]}`}>
        {icons[explanation.impactLevel]}
        <span className="font-semibold uppercase">{labelText} PRIORITY</span>
        <span className="opacity-60 hidden sm:inline-block">· {primaryReason}</span>
      </div>

      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 bottom-full left-0 mb-2 w-64 p-3 bg-surface-highest border border-border rounded-lg shadow-xl"
          >
            <div className="text-xs font-semibold text-text-primary mb-2 flex items-center gap-1.5">
              Why is this {labelText}?
            </div>
            <ul className="space-y-1.5">
              {explanation.reasons.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-text-secondary">
                  <span className="mt-1 w-1 h-1 rounded-full bg-text-tertiary shrink-0" />
                  <span className="leading-tight">{reason}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 pt-2 border-t border-border/50 flex justify-between items-center text-[10px]">
              <span className="text-text-tertiary">Priority Score</span>
              <span className="font-mono text-text-secondary font-semibold">{explanation.priorityScore}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
