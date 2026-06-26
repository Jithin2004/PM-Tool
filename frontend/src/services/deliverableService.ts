import { supabase } from '../lib/supabase';

export interface Milestone {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  description?: string;
  target_date: string;
  status: string; // 'draft', 'submitted_for_review', 'client_review', 'approved', 'changes_requested', 'ready_for_billing', 'billed'
  project_name?: string; // joined
}

export interface MilestoneSignoff {
  id: string;
  workspace_id: string;
  milestone_id: string;
  client_id: string;
  decision: 'approved' | 'changes_requested';
  comments?: string;
  version_reference?: string;
  created_at: string;
}

export const deliverableService = {
  async getMilestones(workspaceId: string, status?: string): Promise<Milestone[]> {
    let query = supabase
      .from('billing_milestones')
      .select('*, projects(name)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });
      
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    return (data || []).map(d => ({
      ...d,
      project_name: d.projects?.name
    }));
  },

  async updateMilestoneStatus(milestoneId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('billing_milestones')
      .update({ status })
      .eq('id', milestoneId);
    
    if (error) throw error;
  },

  async submitSignoff(
    workspaceId: string, 
    milestoneId: string, 
    clientId: string, 
    decision: 'approved' | 'changes_requested', 
    comments?: string, 
    versionReference?: string
  ): Promise<void> {
    // 1. Insert immutable signoff record
    const { error: signoffError } = await supabase
      .from('milestone_signoffs')
      .insert({
        workspace_id: workspaceId,
        milestone_id: milestoneId,
        client_id: clientId,
        decision,
        comments,
        version_reference: versionReference
      });
      
    if (signoffError) throw signoffError;

    // 2. Update milestone status
    const newStatus = decision === 'approved' ? 'approved' : 'changes_requested';
    await this.updateMilestoneStatus(milestoneId, newStatus);
  },

  async getSignoffs(milestoneId: string): Promise<MilestoneSignoff[]> {
    const { data, error } = await supabase
      .from('milestone_signoffs')
      .select('*')
      .eq('milestone_id', milestoneId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data || [];
  }
};
