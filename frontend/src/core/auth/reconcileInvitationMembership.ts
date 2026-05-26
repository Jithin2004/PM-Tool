import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { User, UserRole } from '../../types';

export type ReconcileOutcome =
  | 'existing_member'
  | 'invitation_accepted'
  | 'first_org_bootstrap'
  | 'uninvited'
  | 'error';

export interface ReconcileInvitationInput {
  authUserId: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  /** When present, reconciliation is a no-op bootstrap. */
  existingUserRow?: Record<string, unknown> | null;
}

export interface ReconcileInvitationResult {
  outcome: ReconcileOutcome;
  userRow: Record<string, unknown> | null;
  workspaceId: string | null;
  role: UserRole | null;
  uninvitedProfile?: User;
  error?: string;
}

export interface InvitationRecord {
  id: string;
  email: string;
  workspace_id: string;
  role: UserRole;
  status: string;
  expires_at: string;
}

function designationForRole(role: UserRole): string {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'pm') return 'Project Manager';
  if (role === 'pending-workspace-setup') return 'Pending Setup';
  if (role === 'uninvited') return 'Uninvited User';
  return 'Developer';
}

function rowToProfile(row: Record<string, unknown>): User {
  const role = row.role as UserRole;
  return {
    ...(row as User),
    auth_user_id: row.id as string,
    designation: designationForRole(role),
  };
}

export async function findValidInvitation(email: string): Promise<InvitationRecord | null> {
  if (!isSupabaseConfigured || !email.trim()) return null;

  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from('invitations')
    .select('id, email, workspace_id, role, status, expires_at')
    .ilike('email', normalized)
    .in('status', ['pending', 'accepted'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[reconcileInvitationMembership] invitation lookup failed:', error);
    return null;
  }

  const now = new Date();
  const valid = (data || []).find(
    (row) => row.expires_at && new Date(row.expires_at as string) >= now,
  );

  return valid ? (valid as InvitationRecord) : null;
}

async function markInvitationAccepted(invitationId: string): Promise<void> {
  await supabase
    .from('invitations')
    .update({ status: 'accepted' })
    .eq('id', invitationId)
    .eq('status', 'pending');
}

async function upsertMemberFromInvitation(
  input: ReconcileInvitationInput,
  invite: InvitationRecord,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: input.authUserId,
      email: input.email,
      workspace_id: invite.workspace_id,
      role: invite.role,
      full_name: input.fullName,
      avatar_url: input.avatarUrl ?? null,
      availability_factor: 1,
    })
    .select()
    .single();

  if (error) {
    console.error('[reconcileInvitationMembership] member upsert failed:', error);
    return null;
  }

  if (invite.status === 'pending') {
    await markInvitationAccepted(invite.id);
  }

  return data as Record<string, unknown>;
}

export async function isFreshOrganization(): Promise<boolean> {
  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  console.log("[isFreshOrganization]:", { count, error });
  // A fresh organization has 0 users (before signup) or 1 user (themselves, via auto-create trigger)
  return !error && count !== null && count <= 1;
}

async function bootstrapFirstOrganizationUser(
  input: ReconcileInvitationInput,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: input.authUserId,
      email: input.email,
      workspace_id: null,
      role: 'pending-workspace-setup',
      full_name: input.fullName,
      avatar_url: input.avatarUrl ?? null,
      availability_factor: 1,
    })
    .select()
    .single();

  if (error) {
    console.error('[reconcileInvitationMembership] first-org bootstrap failed:', error);
    return null;
  }

  return data as Record<string, unknown>;
}

/**
 * Deterministic membership reconciliation for a signed-in auth user without a users row.
 * Single entry point — do not duplicate invitation logic elsewhere.
 */
export async function reconcileInvitationMembership(
  input: ReconcileInvitationInput,
): Promise<ReconcileInvitationResult> {
  if (!isSupabaseConfigured) {
    return { outcome: 'error', userRow: null, workspaceId: null, role: null, error: 'supabase_not_configured' };
  }

  if (input.existingUserRow) {
    const role = input.existingUserRow.role as UserRole;
    return {
      outcome: 'existing_member',
      userRow: input.existingUserRow,
      workspaceId: (input.existingUserRow.workspace_id as string) ?? null,
      role,
    };
  }

  const invite = await findValidInvitation(input.email);
  if (invite) {
    const userRow = await upsertMemberFromInvitation(input, invite);
    if (!userRow) {
      return { outcome: 'error', userRow: null, workspaceId: null, role: null, error: 'invitation_upsert_failed' };
    }
    return {
      outcome: 'invitation_accepted',
      userRow,
      workspaceId: invite.workspace_id,
      role: invite.role as UserRole,
    };
  }

  if (await isFreshOrganization()) {
    const userRow = await bootstrapFirstOrganizationUser(input);
    if (!userRow) {
      return { outcome: 'error', userRow: null, workspaceId: null, role: null, error: 'bootstrap_failed' };
    }
    return {
      outcome: 'first_org_bootstrap',
      userRow,
      workspaceId: null,
      role: 'pending-workspace-setup',
    };
  }

  const uninvitedProfile = rowToProfile({
    id: input.authUserId,
    email: input.email,
    role: 'uninvited',
    full_name: input.fullName,
    avatar_url: input.avatarUrl ?? null,
    workspace_id: null,
  });

  return {
    outcome: 'uninvited',
    userRow: null,
    workspaceId: null,
    role: 'uninvited',
    uninvitedProfile,
  };
}

/**
 * Repairs workspace_id for an existing users row (owner or invitation).
 */
export async function reconcileWorkspaceMembership(
  authUserId: string,
  email?: string,
): Promise<{ repaired: boolean; workspaceId: string | null; reason: string }> {
  console.log("[reconcileWorkspaceMembership START]:", { authUserId, email });
  if (!isSupabaseConfigured) {
    return { repaired: false, workspaceId: null, reason: 'supabase_not_configured' };
  }

  const { data: owned, error: ownedError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', authUserId)
    .limit(1);

  console.log("[reconcileWorkspaceMembership] owned workspaces query:", { owned, ownedError });

  if (!ownedError && owned && owned.length > 0) {
    const wsId = owned[0].id;
    const { error: upsertError } = await supabase.from('users').upsert(
      {
        id: authUserId,
        workspace_id: wsId,
        email: email || '',
        role: 'super_admin',
        availability_factor: 1,
      },
      { onConflict: 'id' },
    );

    if (!upsertError) {
      return { repaired: true, workspaceId: wsId, reason: 'workspace_owner_repair' };
    }
  }

  if (email) {
    const invite = await findValidInvitation(email);
    console.log("[reconcileWorkspaceMembership] findValidInvitation result:", invite);
    if (invite) {
      const { error: inviteUpsertError } = await supabase.from('users').upsert(
        {
          id: authUserId,
          email,
          workspace_id: invite.workspace_id,
          role: invite.role,
          availability_factor: 1,
        },
        { onConflict: 'id' },
      );

      if (!inviteUpsertError) {
        if (invite.status === 'pending') {
          await markInvitationAccepted(invite.id);
        }
        return { repaired: true, workspaceId: invite.workspace_id, reason: 'invitation_repair' };
      }
      console.warn("[reconcileWorkspaceMembership] inviteUpsertError:", inviteUpsertError);
      return { repaired: false, workspaceId: null, reason: 'needs_workspace_setup' };
    }
  }

  if (await isFreshOrganization()) {
    console.log("[reconcileWorkspaceMembership] user is first org member. Granting needs_workspace_setup.");
    return { repaired: false, workspaceId: null, reason: 'needs_workspace_setup' };
  }

  console.log("[reconcileWorkspaceMembership] user has no owned workspaces, no valid invites, and not first org member. ORPHANED.");
  return { repaired: false, workspaceId: null, reason: 'orphaned' };
}

export { designationForRole, rowToProfile };
