import { useEffect } from 'react';

/**
 * Custom hook that listens for the Escape key and calls a callback function.
 * @param isOpen Whether the modal/overlay is open.
 * @param onClose Callback to dismiss/close the modal.
 */
export function useEscapeKey(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);
}
