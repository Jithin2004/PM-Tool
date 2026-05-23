import { useEffect, useRef, useCallback } from 'react';
import type { InteractionType, OperationalSection } from './types';

interface InteractionTrackerOptions {
  section: OperationalSection;
  onInteraction: (type: InteractionType) => void;
  onModalChange?: (modalType: string | null) => void;
  onEditChange?: (editing: boolean) => void;
}

const CARD_SELECTOR = '[data-task-id], [data-card-id], [data-epic-id], [data-story-id]';
const DRAG_SELECTOR = '[draggable="true"]';
const MODAL_SELECTOR = '[role="dialog"], [data-modal], .modal-backdrop';
const EDITOR_SELECTOR = '[contenteditable="true"], textarea, input:not([type]), [data-editor]';

export function useInteractionTracker({
  section,
  onInteraction,
  onModalChange,
  onEditChange,
}: InteractionTrackerOptions) {
  const interactionRef = useRef(onInteraction);
  interactionRef.current = onInteraction;

  const modalRef = useRef(onModalChange);
  modalRef.current = onModalChange;

  const editRef = useRef(onEditChange);
  editRef.current = onEditChange;

  const sectionRef = useRef(section);
  sectionRef.current = section;

  useEffect(() => {
    const container = document.getElementById('app-container') || document;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const card = target.closest(CARD_SELECTOR);
      if (card) {
        interactionRef.current('card_click');
        return;
      }
    };

    const handleDragStart = () => {
      interactionRef.current('card_drag');
    };

    const handleDrop = () => {
      interactionRef.current('card_drop');
    };

    const handleModal = (e: Event) => {
      const target = e.target as HTMLElement;
      const modal = target.closest(MODAL_SELECTOR);
      if (modal) {
        const modalType = (modal as HTMLElement).dataset?.modalType || 'general';
        interactionRef.current('modal_open');
        modalRef.current?.(modalType);
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const editor = target.closest(EDITOR_SELECTOR);
      if (editor) {
        interactionRef.current('edit_start');
        editRef.current?.(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const editor = target.closest(EDITOR_SELECTOR);
      if (editor) {
        setTimeout(() => {
          const active = document.activeElement;
          if (!active || !active.closest(EDITOR_SELECTOR)) {
            interactionRef.current('edit_end');
            editRef.current?.(false);
          }
        }, 100);
      }
    };

    container.addEventListener('click', handleClick, { passive: true });
    container.addEventListener('dragstart', handleDragStart, { passive: true });
    container.addEventListener('drop', handleDrop, { passive: true });
    container.addEventListener('click', handleModal, { passive: true });
    document.addEventListener('focusin', handleFocusIn, { passive: true });
    document.addEventListener('focusout', handleFocusOut, { passive: true });

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          const addedNodes = mutation.addedNodes;
          for (const node of Array.from(addedNodes)) {
            if (node instanceof HTMLElement) {
              if (node.closest?.('[data-sprint-planner]')) {
                interactionRef.current('sprint_action');
              }
              if (node.closest?.('[data-dependency-editor]')) {
                interactionRef.current('dependency_edit');
              }
            }
          }
        }
      }
    });

    observer.observe(container, { childList: true, subtree: true });

    return () => {
      container.removeEventListener('click', handleClick);
      container.removeEventListener('dragstart', handleDragStart);
      container.removeEventListener('drop', handleDrop);
      container.removeEventListener('click', handleModal);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      observer.disconnect();
    };
  }, []);
}
