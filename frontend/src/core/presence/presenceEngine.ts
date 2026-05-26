import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { UserRole } from '../../types';
import type {
  OperationalPresence,
  OperationalContext,
  OperationalState,
  OperationalIntent,
  ActivityEntry,
} from './types';
import { buildOperationalContext } from './operationalPresence';
import { hasCapability } from '../auth/permissions';
import { translateAction } from './activityContext';
import { deriveSignals, summarizePresences } from './collaborationSignals';
import { buildPermissionContext } from '../permissions/types';
import { usePresenceStateMachine } from './presenceStateMachine';
import { useIntentEngine } from './intentEngine';
import { useInteractionTracker } from './interactionTracker';
import { onAnyPresenceEvent, type AnyPresenceEvent } from './presenceEvents';
import { describeIntent } from './operationalIntent';

interface UseOperationalPresenceOptions {
  userId: string;
  role: UserRole;
  username: string;
  ownerProjectIds: string[];
}

export function useOperationalPresence(options: UseOperationalPresenceOptions) {
  const [operationalContext, setOperationalContext] = useState<OperationalContext>(buildOperationalContext());
  const [collaborators, setCollaborators] = useState<OperationalPresence[]>([]);
  const [feed, setFeed] = useState<ActivityEntry[]>([]);
  const resolvedIntentRef = useRef<OperationalIntent>('general');

  const permCtx = useMemo(
    () => buildPermissionContext(options.userId, options.role, options.ownerProjectIds),
    [options.userId, options.role, options.ownerProjectIds],
  );

  // Event-driven state machine (replaces polling)
  const { state: operationalState, markActive, debouncedTransition } = usePresenceStateMachine();

  // Intent engine
  const intentEngine = useIntentEngine({
    section: operationalContext.section,
    onIntentChange: (intent, source) => {
      resolvedIntentRef.current = intent;
      debouncedTransition(intent);
    },
  });

  // Interaction tracker
  useInteractionTracker({
    section: operationalContext.section,
    onInteraction: (type) => {
      markActive();
      intentEngine.registerInteraction(type);
    },
    onModalChange: (modalType) => {
      if (modalType) {
        intentEngine.registerModalIntent(modalType);
      }
    },
    onEditChange: (editing) => {
      if (editing) {
        intentEngine.registerInteraction('edit_start');
      }
    },
  });

  // Route-change listener (event-driven, no polling)
  useEffect(() => {
    let prevPath = window.location.pathname;

    const handleRouteChange = () => {
      const currentPath = window.location.pathname;
      if (currentPath === prevPath) return;
      prevPath = currentPath;

      const ctx = buildOperationalContext();
      setOperationalContext(prev => {
        if (prev.projectId !== ctx.projectId || prev.section !== ctx.section) {
          return ctx;
        }
        return prev;
      });

      intentEngine.resetToRouteDefault();
    };

    const routeObserver = new MutationObserver(handleRouteChange);
    const container = document.getElementById('app-container') || document.body;
    routeObserver.observe(container, { childList: true, subtree: true, attributes: false });

    const popHandler = () => handleRouteChange();
    window.addEventListener('popstate', popHandler);

    return () => {
      routeObserver.disconnect();
      window.removeEventListener('popstate', popHandler);
    };
  }, []);

  // Build my presence with intent
  const myPresence: OperationalPresence = useMemo(() => ({
    userId: options.userId,
    username: options.username,
    role: options.role,
    state: operationalState,
    context: operationalContext,
    intent: resolvedIntentRef.current,
    onlineAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    idle: operationalState === 'idle' || operationalState === 'away',
  }), [options.userId, options.username, options.role, operationalState, operationalContext]);

  const addCollaborator = useCallback((presence: OperationalPresence) => {
    setCollaborators(prev => {
      const exists = prev.find(p => p.userId === presence.userId);
      if (exists) return prev.map(p => p.userId === presence.userId ? presence : p);
      return [...prev, presence];
    });
  }, []);

  const removeCollaborator = useCallback((userId: string) => {
    setCollaborators(prev => prev.filter(p => p.userId !== userId));
  }, []);

  const addActivityEntry = useCallback((entry: ActivityEntry) => {
    setFeed(prev => [entry, ...prev].slice(0, 50));
  }, []);

  const logAction = useCallback((action: string, metadata?: Record<string, any>) => {
    const entry = translateAction(
      { action, metadata },
      options.userId,
      options.username,
      operationalContext,
      resolvedIntentRef.current,
    );
    addActivityEntry(entry);
  }, [options.userId, options.username, operationalContext, addActivityEntry]);

  // Permission-gated collaborator visibility
  const visibleCollaborators = useMemo(() => {
    return collaborators.filter(c => {
      if (hasCapability(options.role, 'platform_governance')) return true;
      if (!c.context.projectId) return false;
      if (c.context.projectId === operationalContext.projectId) return true;
      return false;
    });
  }, [collaborators, options.role, operationalContext.projectId]);

  const signals = useMemo(() =>
    deriveSignals(visibleCollaborators, operationalContext.projectId ? { projectId: operationalContext.projectId } : undefined),
  [visibleCollaborators, operationalContext.projectId]);

  const summary = useMemo(() => summarizePresences(visibleCollaborators), [visibleCollaborators]);

  return {
    myPresence,
    collaborators: visibleCollaborators,
    signals,
    feed,
    summary,
    intent: resolvedIntentRef.current,
    setOperationalContext,
    addCollaborator,
    removeCollaborator,
    addActivityEntry,
    logAction,
    registerInteraction: intentEngine.registerInteraction,
    registerCommandIntent: intentEngine.registerCommandIntent,
  };
}
