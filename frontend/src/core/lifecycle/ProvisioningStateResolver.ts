import { ProvisioningState } from './types';
import { User } from '../../types';
import { isProfileComplete } from '../auth/profileCompleteness';

export interface ResolutionInput {
  profile: User | null;
  workspaceRow: { status: string; initialized: boolean } | null;
  licenseResult: { valid: boolean; error?: string };
}

/**
 * pure business decision engine to resolve the correct ProvisioningState.
 * Separates data collection and execution (BootstrapOrchestrator) from the
 * state-machine classification logic.
 */
export function resolveProvisioningState(input: ResolutionInput): ProvisioningState {
  const { profile, workspaceRow, licenseResult } = input;

  // 1. Profile must exist
  if (!profile) {
    return ProvisioningState.PROFILE_MISSING;
  }

  // 2. Profile role must not be 'uninvited'
  if (profile.role === 'uninvited' || (profile as any).status === 'uninvited') {
    return ProvisioningState.PENDING_INVITE;
  }

  // 3. User must have a workspace_id assigned
  if (!profile.workspace_id) {
    return ProvisioningState.WORKSPACE_MISSING;
  }

  // 4. Workspace status must be active or onboarding
  const wsStatus = workspaceRow?.status;
  if (workspaceRow && wsStatus !== 'active' && wsStatus !== 'onboarding') {
    return ProvisioningState.WORKSPACE_INACTIVE;
  }

  // 5. License key must be valid
  if (!licenseResult.valid) {
    return ProvisioningState.LICENSE_REQUIRED;
  }

  // 6. Workspace must be initialized (super_admins only; other users are held)
  if (workspaceRow && !workspaceRow.initialized) {
    return ProvisioningState.WORKSPACE_UNINIT;
  }

  // 7. User profile must be complete
  if (!isProfileComplete(profile)) {
    return ProvisioningState.PROFILE_INCOMPLETE;
  }

  return ProvisioningState.READY;
}
