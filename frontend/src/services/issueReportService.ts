import { supabase } from '../lib/supabase';
import { activityEventService } from './activityEventService';

export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus = 'open' | 'investigating' | 'resolved';

export interface SystemIssueReport {
  id: string;
  workspace_id: string;
  reported_by: string;
  module: string;
  severity: IssueSeverity;
  title: string;
  description: string;
  error_stack?: string;
  browser_metadata?: any;
  status: IssueStatus;
  assigned_to?: string;
  resolved_at?: string;
  created_at: string;
}

export const issueReportService = {
  async createIssueReport(params: {
    workspaceId: string;
    userId: string;
    module: string;
    severity: IssueSeverity;
    title: string;
    description: string;
    errorStack?: string;
    browserMetadata?: any;
  }): Promise<SystemIssueReport> {
    const { data, error } = await supabase
      .from('system_issue_reports')
      .insert({
        workspace_id: params.workspaceId,
        reported_by: params.userId,
        module: params.module,
        severity: params.severity,
        title: params.title,
        description: params.description,
        error_stack: params.errorStack,
        browser_metadata: params.browserMetadata
      })
      .select()
      .single();

    if (error) throw error;

    try {
      await activityEventService.recordActivity({
        workspace_id: params.workspaceId,
        actor_id: params.userId,
        entity_type: 'system_issue',
        entity_id: data.id,
        action: 'system_issue_created',
        metadata: { module: params.module, severity: params.severity }
      });
    } catch (e) {
      console.error('Failed to log system issue event', e);
    }

    return data;
  },

  async updateIssueStatus(issueId: string, status: IssueStatus): Promise<void> {
    const updates: any = { status };
    if (status === 'resolved') {
      updates.resolved_at = new Date().toISOString();
    }
    
    const { error } = await supabase
      .from('system_issue_reports')
      .update(updates)
      .eq('id', issueId);
      
    if (error) throw error;
  },

  async assignIssue(issueId: string, assignedTo: string | null): Promise<void> {
    const { error } = await supabase
      .from('system_issue_reports')
      .update({ assigned_to: assignedTo })
      .eq('id', issueId);
      
    if (error) throw error;
  },

  async getWorkspaceIssues(workspaceId: string): Promise<SystemIssueReport[]> {
    const { data, error } = await supabase
      .from('system_issue_reports')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
};
