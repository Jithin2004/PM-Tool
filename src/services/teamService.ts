import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';

export interface CreateTeamInput {
  workspace_id: string;
  name: string;
  description?: string;
  synthetic?: boolean;
  runId?: string;
}

export async function createTeam(input: CreateTeamInput): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('teams')
      .insert({
        workspace_id: input.workspace_id,
        name: input.name,
        description: input.description || '',
      })
      .select('id')
      .maybeSingle();
    if (error) return null;
    if (data) {
      await activityLogService.appendLog({
        workspace_id: input.workspace_id,
        action: 'team_created',
        metadata: { team_id: data.id, name: input.name, synthetic: input.synthetic, run_id: input.runId },
      });
      return data;
    }
  } catch { /* ignore */ }
  return null;
}
