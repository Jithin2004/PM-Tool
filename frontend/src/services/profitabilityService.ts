import { supabase } from '../lib/supabase';
import { trackSupabaseOperation } from '../core/observability/telemetry';

export interface ProjectProfitability {
  project_id: string;
  project_name: string;
  budget: number;
  revenue: number;
  estimated_cost: number;
  actual_cost: number;
  margin: number;
  margin_percentage: number;
  risk: 'Healthy' | 'At Risk' | 'Over Budget';
  unbilled_approved_work: number;
}

export const profitabilityService = {
  /**
   * Fetches profitability data for all active projects in the workspace.
   * Leverages the `get_project_profitability` RPC to aggregate financials securely.
   */
  async getWorkspaceProfitability(workspaceId: string): Promise<ProjectProfitability[]> {
    const { data, error } = await trackSupabaseOperation('supabase_rpc_get_project_profitability', () => 
      supabase.rpc('get_project_profitability', {
        p_workspace_id: workspaceId
      })
    );

    if (error) {
      console.error('Failed to fetch project profitability', error);
      throw error;
    }

    return (data || []) as ProjectProfitability[];
  }
};
