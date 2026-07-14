import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

/* ================================================================
   RESOLVE PM — Core Modal Component
   Source of truth: Design Bible Phase 10-11, 18
   
   Rules:
     - Max width 640px.
     - Title + close button in header.
     - Action buttons bottom-right, right-aligned.
     - Destructive action left-aligned (bottom-left).
     - Backdrop: 60% opacity overlay.
     - Animation: fade + 4px translateY only (dur-base, ease-standard).
     - Full WCAG AA focus trap and focus restore on close.
   ================================================================ */

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  primaryActionVariant?: 'primary' | 'secondary' | 'destructive';
  primaryActionLoading?: boolean;
  destructiveActionLabel?: string;
  onDestructiveAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  primaryActionLabel,
  onPrimaryAction,
  primaryActionVariant = 'primary',
  primaryActionLoading = false,
  destructiveActionLabel,
  onDestructiveAction,
  secondaryActionLabel,
  onSecondaryAction,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Esc key and focus management
  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement as HTMLElement;
      modalRef.current?.focus();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      if (previousFocus.current) {
        previousFocus.current.focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Trap focus helper
  const handleTabTrap = (e: React.KeyboardEvent) => {
    if (!modalRef.current) return;
    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-[var(--space-4)] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onKeyDown={handleTabTrap}
    >
      {/* Backdrop: 60% opacity overlay */}
      <div
        className="fixed inset-0 bg-[#080A16]/60 transition-opacity duration-[var(--dur-base)] ease-[var(--ease-standard)]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container: Max 640px width, 12px radius, md shadow */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={[
          'relative w-full max-w-[640px] bg-[var(--color-surface-3)] border border-[var(--color-border-strong)]',
          'rounded-[var(--radius-xl)] shadow-[var(--shadow-overlay)] overflow-hidden focus:outline-none',
          'transform transition-all duration-[var(--dur-base)] ease-[var(--ease-standard)]',
          'animate-[resolve-modal-entrance_var(--dur-base)_var(--ease-standard)_forwards]',
        ].join(' ')}
      >
        {/* Style block for local custom modal entrance animation */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes resolve-modal-entrance {
            from {
              opacity: 0;
              transform: translateY(4px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}} />

        {/* Header: Title + close button */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[var(--color-border)]">
          <div className="flex flex-col gap-1 pr-4">
            <h2
              id="modal-title"
              className="text-[15px] font-medium text-[var(--color-text-primary)]"
            >
              {title}
            </h2>
            {description && (
              <p className="text-[13px] text-[var(--color-text-muted)]">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none mt-0.5"
            aria-label="Close dialog"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 text-[var(--text-base)] text-[var(--color-text-secondary)] leading-relaxed max-h-[70vh] overflow-y-auto">
          {children}
        </div>

        {/* Footer: Action buttons */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--color-border)] bg-transparent">
          {/* Left-aligned destructive action */}
          <div>
            {destructiveActionLabel && onDestructiveAction && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onDestructiveAction}
              >
                {destructiveActionLabel}
              </Button>
            )}
          </div>

          {/* Right-aligned primary and secondary actions */}
          <div className="flex items-center gap-[var(--space-3)]">
            {secondaryActionLabel && onSecondaryAction && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onSecondaryAction}
              >
                {secondaryActionLabel}
              </Button>
            )}
            {primaryActionLabel && onPrimaryAction && (
              <Button
                variant={primaryActionVariant}
                size="sm"
                loading={primaryActionLoading}
                onClick={onPrimaryAction}
              >
                {primaryActionLabel}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
