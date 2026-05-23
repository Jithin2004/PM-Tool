import { useState, useEffect, useRef, useCallback } from 'react';
import type { OperationalState, OperationalIntent } from './types';
import { dispatchPresenceEvent } from './presenceEvents';
import { intentToOperationalState } from './operationalIntent';

const IDLE_THRESHOLD_MS = 120_000;
const AWAY_THRESHOLD_MS = 300_000;
const DEBOUNCE_MS = 2_000;

interface StateMachineOptions {
  onStateChange?: (from: OperationalState, to: OperationalState) => void;
}

export function usePresenceStateMachine(options: StateMachineOptions = {}) {
  const [state, setState] = useState<OperationalState>('active');
  const lastActivityRef = useRef(Date.now());
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousStateRef = useRef<OperationalState>('active');

  const markActive = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (state === 'idle' || state === 'away') {
      transitionTo('active');
    }
  }, [state]);

  const transitionTo = useCallback((newState: OperationalState) => {
    const prev = previousStateRef.current;
    if (prev === newState) return;

    previousStateRef.current = newState;
    setState(newState);
    dispatchPresenceEvent({
      type: 'state_change',
      timestamp: Date.now(),
      payload: { from: prev, to: newState },
    });
    options.onStateChange?.(prev, newState);
  }, [options.onStateChange]);

  useEffect(() => {
    const markActiveEvents = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousedown', markActiveEvents, { passive: true });
    window.addEventListener('keydown', markActiveEvents, { passive: true });
    window.addEventListener('touchstart', markActiveEvents, { passive: true });

    const handleVisibility = () => {
      if (document.hidden) {
        dispatchPresenceEvent({
          type: 'visibility_change',
          timestamp: Date.now(),
          payload: { hidden: true },
        });
        transitionTo('away');
      } else {
        const elapsed = Date.now() - lastActivityRef.current;
        dispatchPresenceEvent({
          type: 'visibility_change',
          timestamp: Date.now(),
          payload: { hidden: false },
        });
        if (elapsed < AWAY_THRESHOLD_MS) {
          transitionTo('active');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    idleTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (document.hidden) {
        transitionTo('away');
      } else if (elapsed > AWAY_THRESHOLD_MS) {
        transitionTo('away');
      } else if (elapsed > IDLE_THRESHOLD_MS) {
        transitionTo('idle');
      }
    }, 5_000);

    return () => {
      window.removeEventListener('mousedown', markActiveEvents);
      window.removeEventListener('keydown', markActiveEvents);
      window.removeEventListener('touchstart', markActiveEvents);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
    };
  }, [transitionTo]);

  const debouncedTransition = useCallback((intent: OperationalIntent) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const newState = intentToOperationalState(intent);
      if (state !== 'idle' && state !== 'away') {
        transitionTo(newState);
      }
    }, DEBOUNCE_MS);
  }, [state, transitionTo]);

  return {
    state,
    markActive,
    transitionTo,
    debouncedTransition,
  };
}
