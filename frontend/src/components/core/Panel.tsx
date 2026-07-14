import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

/* ================================================================
   RESOLVE PM — Core Panel Component (Slide-out Drawer)
   Source of truth: Design Bible Phase 12-13, 17
   
   Rules:
     - Panel width: 380px fixed.
     - Slides in from right on action.
     - Elevation: shadow-lg, border-l.
     - Transparent black backdrop (no glassmorphism).
   ================================================================ */

interface PanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Panel({ isOpen, onClose, title, children, footer }: PanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement as HTMLElement;
      panelRef.current?.focus();
    } else {
      if (previousFocus.current) {
        previousFocus.current.focus();
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop: 40% opaque overlay */}
      <div
        className="fixed inset-0 bg-[#080A16]/40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out Drawer Panel: 380px fixed width */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={[
          'relative w-[var(--layout-panel-width)] h-full bg-[var(--color-surface-1)]',
          'border-l border-[var(--color-border)] shadow-[var(--shadow-lg)] flex flex-col focus:outline-none',
          'transform transition-transform duration-[var(--dur-base)] ease-[var(--ease-standard)]',
          'animate-[resolve-panel-slide_var(--dur-base)_var(--ease-standard)_forwards]',
        ].join(' ')}
      >
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes resolve-panel-slide {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}} />

        {/* Panel Header */}
        <div className="flex items-center justify-between px-[var(--space-4)] h-[var(--layout-header-height)] border-b border-[var(--color-border)] flex-shrink-0">
          <h3 className="text-[var(--text-base)] font-medium text-[var(--color-text-primary)] truncate">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none"
            aria-label="Close panel"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto p-[var(--space-4)] text-[var(--text-base)] text-[var(--color-text-secondary)] leading-relaxed">
          {children}
        </div>

        {/* Panel Footer */}
        {footer && (
          <div className="p-[var(--space-4)] border-t border-[var(--color-border)] bg-[var(--color-surface-0)]/50 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
