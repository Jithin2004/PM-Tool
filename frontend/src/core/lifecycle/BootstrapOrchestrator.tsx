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
    if (user) {
      setProvisioningState(ProvisioningState.INITIALIZING);
      orchestrate(user);
    }
  };

  const orchestrate = async (sessionUser: any) => {
    if (isOrchestrating.current) return;
    isOrchestrating.current = true;
    try {
      // 3. Load User Profile
      setBootstrap(BootstrapState.HYDRATING_PROFILE);
      let syncedProfile = await syncProfile(sessionUser);
      
      if (!syncedProfile) {
        // Technically they could be uninvited or just have no profile row
        // We'll treat !syncedProfile as PROFILE_MISSING unless we explicitly know they are uninvited.
        handleProvisioningFailure(ProvisioningState.PROFILE_MISSING, {
          authUserId: sessionUser.id,
          profileFound: false,
          workspaceFound: false
        });
        return;
      }

      // Check if they are uninvited but were caught by reconciliation
      if (syncedProfile.role === 'uninvited' || (syncedProfile as any).status === 'uninvited') {
        handleProvisioningFailure(ProvisioningState.PENDING_INVITE, {
          authUserId: sessionUser.id,
          profileFound: true,
          workspaceFound: false
        });
        return;
      }

      // 4. Resolve Workspace / Validate Access
      setBootstrap(BootstrapState.RESOLVING_WORKSPACE);
      const validation = await validateAndRepairWorkspace(sessionUser, syncedProfile);
      if (validation.updatedProfile) {
        syncedProfile = validation.updatedProfile;
      }

      setProfile(syncedProfile);

      if (!syncedProfile.workspace_id || validation.needsSetup) {
        handleProvisioningFailure(ProvisioningState.WORKSPACE_MISSING, {
          authUserId: sessionUser.id,
          profileFound: true,
          workspaceFound: false
        });
        return;
      }
      
      // Load Workspace Context
      await refreshWorkspace(syncedProfile.workspace_id);

      // Check for inactive workspace (if refreshWorkspace exposes workspace status)
      // Actually we will check the workspace object on next effect or directly if returned.
      // For now, if validateAndRepairWorkspace passed, we assume it's active. 
      // But if we want to explicitly handle WORKSPACE_INACTIVE:
      const { data: wsData } = await supabase.from('workspaces').select('status').eq('id', syncedProfile.workspace_id).maybeSingle();
      if (wsData && wsData.status !== 'active') {
        handleProvisioningFailure(ProvisioningState.WORKSPACE_INACTIVE, {
          authUserId: sessionUser.id,
          profileFound: true,
          workspaceFound: true,
          workspaceId: syncedProfile.workspace_id
        });
        return;
      }

      // 5. Validate Product License
      setBootstrap(BootstrapState.VALIDATING_LICENSE);
      try {
        console.log('[Bootstrap] Validating license for workspace:', syncedProfile.workspace_id);
        const res = await checkLicenseOnline(syncedProfile.workspace_id);
        console.log('[Bootstrap] License validation result:', res);
        if (!res.valid) {
          console.error('[Bootstrap] License invalid, setting LICENSE_REQUIRED', res);
          handleProvisioningFailure(ProvisioningState.LICENSE_REQUIRED, {
            authUserId: sessionUser.id,
            profileFound: true,
            workspaceFound: true,
            workspaceId: syncedProfile.workspace_id
          });
          return;
        }
      } catch (licenseErr) {
        // Fallback for offline mode if allowed, or force activation
        handleProvisioningFailure(ProvisioningState.LICENSE_REQUIRED, {
          authUserId: sessionUser.id,
          profileFound: true,
          workspaceFound: true,
          workspaceId: syncedProfile.workspace_id
        });
        return;
      }
      
      // 7. Initialize Operational Context
      await refreshAll();

      // 8. Start Background Services
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
