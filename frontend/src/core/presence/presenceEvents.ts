import type { OperationalState, OperationalContext, OperationalIntent } from './types';

export type PresenceEventType =
  | 'state_change'
  | 'context_change'
  | 'intent_change'
  | 'activity'
  | 'visibility_change'
  | 'reconnect';

export interface PresenceEvent {
  type: PresenceEventType;
  timestamp: number;
  payload: Record<string, unknown>;
}

export interface StateChangeEvent extends PresenceEvent {
  type: 'state_change';
  payload: {
    from: OperationalState;
    to: OperationalState;
  };
}

export interface ContextChangeEvent extends PresenceEvent {
  type: 'context_change';
  payload: {
    from: OperationalContext;
    to: OperationalContext;
  };
}

export interface IntentChangeEvent extends PresenceEvent {
  type: 'intent_change';
  payload: {
    from: OperationalIntent;
    to: OperationalIntent;
    source: string;
  };
}

export interface VisibilityChangeEvent extends PresenceEvent {
  type: 'visibility_change';
  payload: {
    hidden: boolean;
  };
}

export type AnyPresenceEvent =
  | StateChangeEvent
  | ContextChangeEvent
  | IntentChangeEvent
  | VisibilityChangeEvent;

type PresenceListener = (event: AnyPresenceEvent) => void;

const listeners = new Map<PresenceEventType, Set<PresenceListener>>();
const wildcardListeners = new Set<PresenceListener>();

export function onPresenceEvent(type: PresenceEventType, listener: PresenceListener): () => void {
  if (!listeners.has(type)) {
    listeners.set(type, new Set());
  }
  listeners.get(type)!.add(listener);
  return () => { listeners.get(type)?.delete(listener); };
}

export function onAnyPresenceEvent(listener: PresenceListener): () => void {
  wildcardListeners.add(listener);
  return () => { wildcardListeners.delete(listener); };
}

export function dispatchPresenceEvent(event: AnyPresenceEvent): void {
  const typeListeners = listeners.get(event.type);
  if (typeListeners) {
    for (const listener of typeListeners) {
      listener(event);
    }
  }
  for (const listener of wildcardListeners) {
    listener(event);
  }
}
