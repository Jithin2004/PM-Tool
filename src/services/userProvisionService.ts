import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';

export interface ProvisionSyntheticUserInput {
  workspace_id: string;
  email: string;
  full_name: string;
  role: string;
  availability_factor: number;
  synthetic?: boolean;
  runId?: string;
}

export async function provisionSyntheticUser(input: ProvisionSyntheticUserInput): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('users')
      .insert({
        workspace_id: input.workspace_id,
        email: input.email,
        full_name: input.full_name,
        role: input.role,
        availability_factor: input.availability_factor,
      })
      .select('id')
      .maybeSingle();
    if (error) return null;
    if (data) {
      await activityLogService.appendLog({
        workspace_id: input.workspace_id,
        action: 'user_provisioned',
        metadata: { user_id: data.id, email: input.email, role: input.role, synthetic: input.synthetic, run_id: input.runId },
      });
      return data;
    }
  } catch { /* ignore */ }
  return null;
}
