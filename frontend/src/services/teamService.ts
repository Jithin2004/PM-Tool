import { trackSupabaseOperation } from '../core/observability/telemetry';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';
import { logServiceFailure } from '../utils/supabaseError';

export interface CreateTeamInput {
  workspace_id: string;
  name: string;
  synthetic?: boolean;
  runId?: string;
}

export async function createTeam(input: CreateTeamInput): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await trackSupabaseOperation('supabase_from_teams', () => supabase
      .from('teams')
      .insert({
        workspace_id: input.workspace_id,
        name: input.name,
      })
      .select('id')
      .maybeSingle());
    if (error) { logServiceFailure('createTeam', input, error); return null; }
    if (data) {
      await activityLogService.appendLog({
        workspace_id: input.workspace_id,
        action: 'team_created',
        metadata: { team_id: data.id, name: input.name, synthetic: input.synthetic, run_id: input.runId },
      });
      return data;
    }
  } catch (err) { logServiceFailure('createTeam', input, err); }
  return null;
}
