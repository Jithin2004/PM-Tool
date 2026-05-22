import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';
import { sha256 } from '../utils/cryptoUtils';

export interface ApiKey {
  id: string;
  workspace_id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  created_by?: string;
  last_used_at?: string;
  expires_at?: string;
  revoked: boolean;
  created_at: string;
}

const KEY_BYTE_LENGTH = 32;

function generateKey(): { raw: string; prefix: string } {
  const bytes = new Uint8Array(KEY_BYTE_LENGTH);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes).map(b => b.toString(36).padStart(2, '0')).join('');
  const prefix = raw.slice(0, 8);
  return { raw: `rp_${raw}`, prefix };
}

export async function createApiKey(
  workspaceId: string, name: string, permissions: string[], createdBy?: string
): Promise<{ key: ApiKey; rawKey: string } | null> {
  if (!isSupabaseConfigured) return null;
  const { raw, prefix } = generateKey();
  const keyHash = await sha256(raw);
  try {
    const { data } = await supabase.from('api_keys').insert({
      workspace_id: workspaceId, name, key_hash: keyHash, key_prefix: prefix,
      permissions, created_by: createdBy,
    }).select().single();
    if (data) {
      await activityLogService.appendLog({
        workspace_id: workspaceId, actor_id: createdBy,
        action: 'api_key_created',
        metadata: { key_id: data.id, name, permissions },
      });
      return { key: data as ApiKey, rawKey: raw };
    }
  } catch { /* ignore */ }
  return null;
}

export async function fetchApiKeys(workspaceId: string): Promise<ApiKey[]> {
  if (!isSupabaseConfigured || !workspaceId) return [];
  try {
    const { data } = await supabase
      .from('api_keys')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('revoked', false)
      .order('created_at', { ascending: false });
    if (data) return data as ApiKey[];
  } catch { /* ignore */ }
  return [];
}

export async function revokeApiKey(keyId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await supabase.from('api_keys').update({ revoked: true }).eq('id', keyId);
    return true;
  } catch { return false; }
}

export async function verifyApiKey(rawKey: string, requiredPermission?: string): Promise<{ valid: boolean; workspaceId?: string }> {
  if (!isSupabaseConfigured) return { valid: false };
  try {
    const keyHash = await sha256(rawKey.replace(/^rp_/, ''));
    const { data } = await supabase
      .from('api_keys')
      .select('workspace_id, permissions, revoked, expires_at')
      .eq('key_hash', keyHash)
      .single();
    if (!data || data.revoked) return { valid: false };
    if (data.expires_at && new Date(data.expires_at) < new Date()) return { valid: false };
    if (requiredPermission && !data.permissions.includes(requiredPermission) && !data.permissions.includes('admin')) {
      return { valid: false };
    }
    return { valid: true, workspaceId: data.workspace_id };
  } catch { return { valid: false }; }
}

// ── API Router helpers ──

export function extractApiKey(req: { headers: Record<string, string> }): string | null {
  const auth = req.headers['authorization'] || '';
  const match = auth.match(/^Bearer\s+(rp_.+)$/i);
  return match ? match[1] : null;
}
