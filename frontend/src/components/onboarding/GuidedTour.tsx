import React, { useEffect, useState, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

export interface TourStep {
  title: string;
  description: string;
  targetSelector?: string;
  actionBefore?: () => void;
}

interface GuidedTourProps {
  steps: TourStep[];
  currentStepIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export function GuidedTour({
  steps,
  currentStepIndex,
  isOpen,
  onClose,
  onNext,
  onPrev,
}: GuidedTourProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  const step = steps[currentStepIndex];

  useLayoutEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });

      if (step?.targetSelector) {
        const el = document.querySelector(step.targetSelector);
        if (el) {
          const rect = el.getBoundingClientRect();
          setTargetRect(prev => {
            if (!prev) return rect;
            if (
              Math.abs(prev.top - rect.top) < 1 &&
              Math.abs(prev.left - rect.left) < 1 &&
              Math.abs(prev.width - rect.width) < 1 &&
              Math.abs(prev.height - rect.height) < 1
            ) {
              return prev;
            }
            return rect;
          });
        } else {
          setTargetRect(null);
        }
      } else {
        setTargetRect(null);
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    
    // Poll position to handle dynamic rendering or animations
    const interval = setInterval(updatePosition, 250);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      clearInterval(interval);
    };
  }, [isOpen, step?.targetSelector]);

  if (!isOpen || !step) return null;

  // Calculate popover position
  let popoverStyle: React.CSSProperties = {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  };

  if (targetRect) {
    const padding = 16;
    const popoverWidth = 350;
    const spaceBelow = windowSize.height - targetRect.bottom;
    const spaceRight = windowSize.width - targetRect.right;
    const spaceLeft = targetRect.left;
    const spaceAbove = targetRect.top;

    if (spaceRight >= popoverWidth + padding) {
      // Place on right
      popoverStyle = {
        top: Math.max(padding, Math.min(targetRect.top, windowSize.height - 300)),
        left: targetRect.right + padding,
      };
    } else if (spaceLeft >= popoverWidth + padding) {
      // Place on left
      popoverStyle = {
        top: Math.max(padding, Math.min(targetRect.top, windowSize.height - 300)),
        left: targetRect.left - popoverWidth - padding,
      };
    } else if (spaceBelow >= 300) {
      // Place below
      popoverStyle = {
        top: targetRect.bottom + padding,
        left: Math.max(padding, Math.min(targetRect.left, windowSize.width - popoverWidth - padding)),
      };
    } else if (spaceAbove >= 300) {
      // Place above
      popoverStyle = {
        top: targetRect.top - padding - 250, // rough height of popover
        left: Math.max(padding, Math.min(targetRect.left, windowSize.width - popoverWidth - padding)),
      };
    } else {
      // Center fallback if no space
      popoverStyle = {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Spotlight Overlay */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto transition-all duration-500 ease-in-out"
        style={{ zIndex: -1 }}
      >
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - 8}
                y={targetRect.top - 8}
                width={targetRect.width + 16}
                height={targetRect.height + 16}
                rx="8"
                ry="8"
                fill="black"
                className="transition-all duration-500 ease-in-out"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.7)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Popover Card */}
      <div 
        className="absolute w-[350px] pointer-events-auto transition-all duration-500 ease-in-out"
        style={popoverStyle}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStepIndex}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="w-full bg-[#0e0e0e]/95 border border-border rounded-xl p-6 shadow-[0_20px_60px_rgba(59,130,246,0.15)] relative overflow-hidden backdrop-blur-md"
          >
            {/* Core accent gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wide text-signal-info bg-surface-3 px-2 py-0.5 rounded-sm">
                  Step {currentStepIndex + 1} of {steps.length}
                </span>
                <h3 className="text-lg font-bold tracking-tight text-text-primary mt-2">
                  {step.title}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="text-text-quaternary hover:text-text-primary transition-colors cursor-pointer text-[10px] font-mono uppercase tracking-wider bg-[var(--pm-surface)]/5 hover:bg-[var(--pm-surface)]/10 px-2 py-1 rounded"
              >
                Skip
              </button>
            </div>

            {/* Body Description */}
            <p className="text-sm text-neutral-300 leading-relaxed font-sans mb-6">
              {step.description}
            </p>

            {/* Navigation Controls */}
            <div className="flex justify-between items-center pt-4 border-t border-border">
              <button
                disabled={currentStepIndex === 0}
                onClick={onPrev}
                className={`px-3 py-1.5 border border-border text-[11px] font-mono uppercase tracking-wider hover:bg-[var(--pm-surface)]/5 transition-all rounded-md flex items-center gap-1 cursor-pointer ${currentStepIndex === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <ChevronLeft className="w-3 h-3" />
                Back
              </button>

              <button
                onClick={currentStepIndex === steps.length - 1 ? onClose : onNext}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-text-primary text-[11px] font-mono uppercase tracking-wider transition-all rounded-md flex items-center gap-1 shadow-sm cursor-pointer"
              >
                {currentStepIndex === steps.length - 1 ? 'Finish' : 'Next'}
                {currentStepIndex < steps.length - 1 && <ChevronRight className="w-3 h-3 transition-opacity duration-300" />}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
