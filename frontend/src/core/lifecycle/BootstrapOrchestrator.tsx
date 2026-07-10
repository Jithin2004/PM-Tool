import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { AuthState, BootstrapState, ProvisioningState } from './types';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { checkLicenseOnline } from '../../lib/productKey';
import { syncProfile } from '../../services/authProfileService';
import { validateAndRepairWorkspace } from '../../services/authWorkspaceService';
import { User } from '../../types';
import { BootLogger } from './bootLogger';
import { TelemetryService } from '../observability/telemetry';
import { resolveProvisioningState } from './ProvisioningStateResolver';

// We will inject the lifecycle aware services here or instantiate them
// e.g. telemetryEngine, notificationEngine, etc.

interface BootstrapContextValue {
  authState: AuthState;
  bootstrapState: BootstrapState;
  provisioningState: ProvisioningState;
  error: Error | null;
  retryProvisioning: () => void;
}

const BootstrapContext = createContext<BootstrapContextValue | undefined>(undefined);

export function useBootstrap() {
  const context = useContext(BootstrapContext);
  if (!context) throw new Error('useBootstrap must be used within BootstrapOrchestrator');
  return context;
}

export function BootstrapOrchestrator({ children }: { children: React.ReactNode }) {
  const { authState, setAuthState, setUser, setProfile, profile } = useAuth();
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>(BootstrapState.IDLE);
  const [provisioningState, setProvisioningState] = useState<ProvisioningState>(ProvisioningState.INITIALIZING);
  const [error, setError] = useState<Error | null>(null);

  const isOrchestrating = useRef(false);
  const sessionUserRef = useRef<any>(null);

  const { setWorkspace, refreshWorkspace, workspace } = useWorkspace();
  const { refreshAll } = useOperationalData();

  // Helper to log state transitions
  const logEvent = (state: string) => {
    BootLogger.log(state, 'State Transition');
    // Emit custom event for observability
    window.dispatchEvent(new CustomEvent('resolve-lifecycle-event', { detail: { state } }));
  };

  const setBootstrap = (state: BootstrapState) => {
    logEvent(state);
    setBootstrapState(state);
  };

  const handleProvisioningFailure = (state: ProvisioningState, details: any = {}) => {
    BootLogger.log(state, 'Provisioning Outcome');
    setProvisioningState(state);
    setBootstrap(BootstrapState.READY); // Bootstrap is technically "done" evaluating
    
    // Structured JSON log for support diagnostics
    BootLogger.warn("Provisioning failed", {
      authUser: details.authUserId || "unknown",
      profileFound: details.profileFound || false,
      workspaceFound: details.workspaceFound || false,
      workspaceId: details.workspaceId || null,
      provisioningState: state
    });
  };

  const retryProvisioning = () => {
    if (sessionUserRef.current) {
      setProvisioningState(ProvisioningState.INITIALIZING);
      orchestrate(sessionUserRef.current);
    }
  };

  const orchestrate = async (sessionUser: any) => {
    if (isOrchestrating.current) return;
    isOrchestrating.current = true;
    sessionUserRef.current = sessionUser;
    try {
      // 3. Load User Profile
      setBootstrap(BootstrapState.HYDRATING_PROFILE);
      let syncedProfile = await syncProfile(sessionUser);

      if (syncedProfile) {
        setProfile(syncedProfile);
      }

      // 4. Validate and repair workspace ID mapping
      let workspaceNeedsSetup = false;
      if (syncedProfile) {
        setBootstrap(BootstrapState.RESOLVING_WORKSPACE);
        const validation = await validateAndRepairWorkspace(sessionUser, syncedProfile);
        if (validation.updatedProfile) {
          syncedProfile = validation.updatedProfile;
          setProfile(syncedProfile);
        }
        workspaceNeedsSetup = validation.needsSetup;
      }

      // 5. Parallel: Workspace info + license check (saves one sequential roundtrip)
      setBootstrap(BootstrapState.VALIDATING_LICENSE);
      const [wsResult, licenseResult] = syncedProfile?.workspace_id
        ? await Promise.all([
            supabase
              .from('workspaces')
              .select('status, initialized')
              .eq('id', syncedProfile.workspace_id)
              .maybeSingle(),
            checkLicenseOnline(syncedProfile.workspace_id)
          ])
        : [{ data: null }, { valid: false, error: 'No workspace' }];

      // Hydrate workspace into React context
      if (syncedProfile?.workspace_id) {
        refreshWorkspace(syncedProfile.workspace_id);
      }

      // 6. Delegate classification to ProvisioningStateResolver
      const resolvedState = resolveProvisioningState({
        profile: syncedProfile,
        workspaceRow: wsResult.data,
        licenseResult
      });

      // Handle override for missing workspace detected by validation helper
      let finalState = resolvedState;
      if (resolvedState === ProvisioningState.READY && workspaceNeedsSetup) {
        finalState = ProvisioningState.WORKSPACE_MISSING;
      }

      // If we are not READY, fail fast and early-return
      if (finalState !== ProvisioningState.READY) {
        handleProvisioningFailure(finalState, {
          authUserId: sessionUser.id,
          profileFound: !!syncedProfile,
          workspaceFound: !!wsResult.data,
          workspaceId: syncedProfile?.workspace_id || null
        });
        return;
      }

      // 8. Initialize Operational Context
      await refreshAll();

      // 9. Start Background Services
      setBootstrap(BootstrapState.INITIALIZING_SERVICES);

    } catch (err: any) {
      console.error('Bootstrap Error:', err);
      setError(err);
      setBootstrap(BootstrapState.ERROR);
    } finally {
      isOrchestrating.current = false;
    }
  };

  useEffect(() => {
    if (bootstrapState === BootstrapState.INITIALIZING_SERVICES) {
      logEvent('INITIALIZING_SERVICES');
      try {
        const appContext = { user: null, profile, workspace, session: null } as any;

        import('../observability/telemetry').then(({ TelemetryService }) => TelemetryService.initialize(appContext));
        import('../engines/integrationEngine').then(({ IntegrationService }) => IntegrationService.initialize(appContext));
        import('../engines/notificationEngine').then(({ notificationEngine }) => notificationEngine.initialize(appContext));
        import('../../services/activityEventService').then(({ activityEventService }) => activityEventService.initialize(appContext));
        import('../engines/automationEngine').then(({ automationEngine }) => automationEngine.initialize(appContext));
        import('../presence/PresenceService').then(({ PresenceService }) => PresenceService.initialize(appContext));

        setProvisioningState(ProvisioningState.READY);
        setBootstrap(BootstrapState.READY);
      } catch (err: any) {
        setError(err);
        setBootstrap(BootstrapState.ERROR);
      }
    }
  }, [bootstrapState, profile, workspace]);

  useEffect(() => {
    return () => {
      import('../observability/telemetry').then(({ TelemetryService }) => TelemetryService.dispose());
      import('../engines/integrationEngine').then(({ IntegrationService }) => IntegrationService.dispose());
      import('../engines/notificationEngine').then(({ notificationEngine }) => notificationEngine.dispose());
      import('../../services/activityEventService').then(({ activityEventService }) => activityEventService.dispose());
      import('../engines/automationEngine').then(({ automationEngine }) => automationEngine.dispose());
      import('../presence/PresenceService').then(({ PresenceService }) => PresenceService.dispose());
    };
  }, []);

  useEffect(() => {
    logEvent(AuthState.BOOTING);

    const initAuth = async () => {
      setAuthState(AuthState.AUTHENTICATING);
      logEvent(AuthState.AUTHENTICATING);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        setAuthState(AuthState.UNAUTHENTICATED);
        logEvent(AuthState.UNAUTHENTICATED);
        setBootstrap(BootstrapState.IDLE);
        setProvisioningState(ProvisioningState.INITIALIZING);
        return;
      }

      setAuthState(AuthState.AUTHENTICATED);
      logEvent(AuthState.AUTHENTICATED);
      setUser(session.user);
      
      // Start bootstrap sequence
      orchestrate(session.user);
    };

    initAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        setAuthState(AuthState.UNAUTHENTICATED);
        logEvent(AuthState.UNAUTHENTICATED);
        setBootstrap(BootstrapState.IDLE);
        setProvisioningState(ProvisioningState.INITIALIZING);
        setUser(null);
        setProfile(null);
        setWorkspace(null);
        import('../observability/telemetry').then(({ TelemetryService }) => TelemetryService.dispose());
        import('../engines/integrationEngine').then(({ IntegrationService }) => IntegrationService.dispose());
        import('../engines/notificationEngine').then(({ notificationEngine }) => notificationEngine.dispose());
        import('../../services/activityEventService').then(({ activityEventService }) => activityEventService.dispose());
        import('../engines/automationEngine').then(({ automationEngine }) => automationEngine.dispose());
        import('../presence/PresenceService').then(({ PresenceService }) => PresenceService.dispose());
      } else if (event === 'SIGNED_IN' && session) {
        setAuthState(AuthState.AUTHENTICATED);
        logEvent(AuthState.AUTHENTICATED);
        setUser(session.user);
        orchestrate(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <BootstrapContext.Provider value={{ authState, bootstrapState, provisioningState, error, retryProvisioning }}>
      {children}
    </BootstrapContext.Provider>
  );
}
