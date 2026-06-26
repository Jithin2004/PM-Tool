import { supabase } from '../lib/supabase';


export type JournalProviderType = 'Meeting' | 'Approval' | 'Decision' | 'Risk' | 'Finance' | 'Deployment' | 'Milestone' | 'Scope Change' | 'Client Communication' | 'Knowledge';

export interface JournalEvent {
  id: string;
  projectId: string;
  providerType: JournalProviderType;
  eventType: string; // e.g., 'created', 'approved', 'rejected'
  title: string;
  summary?: string;
  occurredAt: string;
  actor?: string; // name or email
  relatedMilestoneId?: string;
  relatedTaskId?: string;
  status?: string;
  severity?: 'info' | 'warning' | 'critical' | 'success';
  payload: any;
  metadata?: any;
}

export const journalService = {
  async getProjectJournal(projectId: string): Promise<JournalEvent[]> {
    const events: JournalEvent[] = [];

    // 1. Fetch Meetings
    const { data: meetings, error: mError } = await supabase
      .from('meetings')
      .select('*, organizer:users!meetings_organizer_id_fkey(email, full_name)')
      .eq('project_id', projectId)
      .is('deleted_at', null);
      
    if (mError) {
      console.error('Failed to fetch meetings for journal', mError);
    } else {
      (meetings || []).forEach((m: any) => {
        events.push({
          id: m.id,
          projectId: m.project_id,
          providerType: 'Meeting',
          eventType: m.meeting_type || 'Meeting',
          title: m.title,
          summary: m.summary || m.agenda,
          occurredAt: m.date + 'T' + m.time,
          actor: m.organizer?.full_name || m.organizer?.email || 'Unknown',
          relatedMilestoneId: m.milestone_id,
          relatedTaskId: m.task_id,
          status: m.status,
          severity: 'info',
          payload: m
        });
      });
    }

    // 2. Fetch Approvals
    const { data: approvals, error: aError } = await supabase
      .from('universal_approvals')
      .select('*, requested:users!universal_approvals_requested_by_fkey(email, full_name), approver:users!universal_approvals_approved_by_fkey(email, full_name)')
      .eq('project_id', projectId);

    if (aError) {
      console.error('Failed to fetch approvals for journal', aError);
    } else {
      (approvals || []).forEach((a: any) => {
        let severity: 'info' | 'warning' | 'critical' | 'success' = 'info';
        if (['Approved', 'Approved with Conditions'].includes(a.decision)) severity = 'success';
        else if (['Rejected', 'Cancelled', 'Expired'].includes(a.decision)) severity = 'critical';
        else if (['Returned for Revision', 'Escalated', 'Deferred'].includes(a.decision)) severity = 'warning';

        events.push({
          id: a.id,
          projectId: a.project_id,
          providerType: 'Approval',
          eventType: a.approval_type || 'General Approval',
          title: 'Approval: ' + (a.approval_type || 'Request'),
          summary: a.decision_summary || a.reason || a.note,
          occurredAt: a.updated_at || a.created_at,
          actor: a.approver?.full_name || a.approver?.email || a.requested?.full_name || 'System',
          relatedMilestoneId: a.milestone_id,
          relatedTaskId: a.task_id,
          status: a.decision,
          severity,
          payload: a
        });
      });
    }

    // Sort descending by date (newest first)
    events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    return events;
  }
};

