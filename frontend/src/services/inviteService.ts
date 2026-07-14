import { supabase } from '../lib/supabase';
import type { UserRole } from '../types';
import { enterpriseEventPublisher } from './enterpriseEventPublisher';


export interface CreateInvitationInput {
  email: string;
  workspaceId: string;
  role: UserRole;
  expiresInDays?: number;
  createdBy?: string;
}

export interface InvitationResult {
  success: boolean;
  inviteUrl?: string;
  error?: string;
}

export class InviteService {
  /**
   * Generates a cryptographically random token using the Web Crypto API
   */
  private static generateToken(): string {
    return crypto.randomUUID();
  }

  /**
   * Creates a pending invitation and returns the full acceptance URL.
   */
  static async createInvitation({
    email,
    workspaceId,
    role,
    expiresInDays = 7,
    createdBy,
  }: CreateInvitationInput): Promise<InvitationResult> {
    try {
      const token = this.generateToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const { error } = await supabase.from('invitations').insert({
        email: email.trim().toLowerCase(),
        workspace_id: workspaceId,
        role,
        token,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        created_by: createdBy || null,
      });

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'An invitation already exists for this email.' };
        }
        return { success: false, error: error.message };
      }

      try {
        await enterpriseEventPublisher.publish({
          workspace_id: workspaceId,
          user_id: createdBy,
          entity_type: 'user',
          verb: 'user_invited',
          title: 'User Invited',
          description: `Invited user ${email} as ${role}.`,
          severity: 'low',
          importance: 'important',
          icon_key: 'warning',
          visibility: 'admin',
          module: 'administration',
          metadata: { email, role }
        });
      } catch (e) {
        console.error('Failed to log user_invited event:', e);
      }

      const inviteUrl = `${window.location.origin}/accept-invite/${token}`;
      return { success: true, inviteUrl };
      
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create invitation' };
    }
  }

  /**
   * Revokes an existing invitation
   */
  static async revokeInvitation(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('invitations')
      .update({ status: 'revoked' })
      .eq('id', id);
      
    return !error;
  }
}
