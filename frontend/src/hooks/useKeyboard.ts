import { useEffect, useRef } from 'react';

interface Shortcut {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  handler: (e: KeyboardEvent) => void;
}

export function useKeyboard(shortcuts: Shortcut[], enabled = true) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      for (const s of shortcutsRef.current) {
        const metaMatch = s.meta ? (e.metaKey || e.ctrlKey) : true;
        const ctrlMatch = s.ctrl ? e.ctrlKey : true;
        const shiftMatch = s.shift ? e.shiftKey : true;
        const keyMatch = e.key.toLowerCase() === s.key.toLowerCase() && !e.metaKey && !e.ctrlKey && !e.altKey;

        if (metaMatch && ctrlMatch && shiftMatch && (keyMatch || (s.meta && s.key.toLowerCase() === e.key.toLowerCase()))) {
          e.preventDefault();
          s.handler(e);
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled]);
}

export function useGlobalShortcuts(onOpenPalette: () => void) {
  useKeyboard([
    { key: 't', handler: () => window.dispatchEvent(new CustomEvent('quick-action', { detail: { action_type: 'create-task' } })) },
    { key: 'p', handler: () => window.dispatchEvent(new CustomEvent('quick-action', { detail: { action_type: 'create-project' } })) },
  ]);
}
