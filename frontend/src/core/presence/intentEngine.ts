import { useState, useCallback, useRef } from 'react';
import type {
  OperationalIntent,
  IntentSignal,
  InteractionType,
  OperationalSection,
} from './types';
import { resolveIntent } from './operationalIntent';
import { resolveInteractionSignal, resolveModalIntent, detectMutationIntent } from './interactionSignals';

interface UseIntentEngineOptions {
  section: OperationalSection;
  onIntentChange?: (intent: OperationalIntent, source: string) => void;
}

export function useIntentEngine(options: UseIntentEngineOptions) {
  const [currentIntent, setCurrentIntent] = useState<OperationalIntent>('general');
  const [activeSignals, setActiveSignals] = useState<IntentSignal[]>([]);
  const signalsRef = useRef<IntentSignal[]>([]);

  const addSignal = useCallback((signal: IntentSignal) => {
    signalsRef.current = [...signalsRef.current.filter(s => s.source !== signal.source), signal];
    const resolved = resolveIntent(signalsRef.current);
    setActiveSignals(signalsRef.current);
    if (resolved !== currentIntent) {
      setCurrentIntent(resolved);
      options.onIntentChange?.(resolved, signal.source);
    }
  }, [currentIntent, options.onIntentChange]);

  const removeSignal = useCallback((source: string) => {
    signalsRef.current = signalsRef.current.filter(s => s.source !== source);
    setActiveSignals(signalsRef.current);
    const resolved = resolveIntent(signalsRef.current);
    setCurrentIntent(resolved);
  }, []);

  const registerInteraction = useCallback((interactionType: InteractionType) => {
    const signal = resolveInteractionSignal(interactionType, options.section);
    addSignal(signal);
    return signal;
  }, [addSignal, options.section]);

  const registerModalIntent = useCallback((modalType: string) => {
    const signal = resolveModalIntent(modalType);
    if (signal) {
      addSignal(signal);
      return signal;
    }
    return null;
  }, [addSignal]);

  const registerMutationIntent = useCallback((target: Element) => {
    const signal = detectMutationIntent(target);
    if (signal) {
      addSignal(signal);
      return signal;
    }
    return null;
  }, [addSignal]);

  const registerCommandIntent = useCallback((intent: OperationalIntent) => {
    const signal: IntentSignal = { intent, source: 'command', confidence: 0.9 };
    addSignal(signal);
  }, [addSignal]);

  const resetToRouteDefault = useCallback(() => {
    signalsRef.current = [];
    setActiveSignals([]);
    setCurrentIntent('general');
  }, []);

  return {
    currentIntent,
    activeSignals,
    registerInteraction,
    registerModalIntent,
    registerMutationIntent,
    registerCommandIntent,
    removeSignal,
    resetToRouteDefault,
  };
}
