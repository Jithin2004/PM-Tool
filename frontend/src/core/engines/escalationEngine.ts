import { supabase } from '../../lib/supabase';
import type { Task } from '../../types';

export const escalationEngine = {
  /**
   * Scans a project for risks and triggers Decision Center items
   */
  async scanProjectRisks(workspaceId: string, projectId: string) {
    // 1. Fetch Intelligence Settings
    const { data: settingsRow } = await supabase
      .from('workspace_intelligence_settings')
      .select('settings')
      .eq('workspace_id', workspaceId)
      .single();

    const settings = settingsRow?.settings || {
      blocker_warning_days: 2,
      blocker_critical_days: 5,
      capacity_warning: 90
    };

    // 2. Fetch Tasks in Progress / Blocked
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .in('status', ['blocked', 'in_progress', 'review']);

    if (!tasks) return;

    const escalations = [];
    const now = new Date().getTime();

    for (const task of tasks) {
      if (task.status === 'blocked' && task.updated_at) {
        const blockTime = now - new Date(task.updated_at).getTime();
        const blockDays = blockTime / (1000 * 60 * 60 * 24);

        if (blockDays >= settings.blocker_critical_days) {
          escalations.push({
            type: 'critical_blocker',
            taskId: task.id,
            message: `Task blocked for ${Math.round(blockDays)} days (Critical)`
          });
        } else if (blockDays >= settings.blocker_warning_days) {
          escalations.push({
            type: 'warning_blocker',
            taskId: task.id,
            message: `Task blocked for ${Math.round(blockDays)} days (Warning)`
          });
        }
      }

      if (task.deadline) {
        const deadlineMs = new Date(task.deadline).getTime();
        if (now > deadlineMs && task.status !== 'done') {
          escalations.push({
            type: 'deadline_drift',
            taskId: task.id,
            message: `Task past deadline by ${Math.round((now - deadlineMs)/(1000*60*60*24))} days`
          });
        }
      }
    }

    // 3. Route to Decision Center
    for (const esc of escalations) {
      await this.routeToDecisionCenter(workspaceId, projectId, esc);
    }
  },

  async routeToDecisionCenter(workspaceId: string, projectId: string, escalation: any) {
    // Decision Center Integration
    // Create an actionable item for the PM/Owner
    
    // Check if duplicate exists first
    const { data: existing } = await supabase
      .from('universal_approvals')
      .select('id')
      .eq('entity_id', escalation.taskId)
      .eq('type', 'risk_escalation')
      .eq('status', 'pending');

    if (existing && existing.length > 0) return; // Already escalated

    await supabase
      .from('universal_approvals')
      .insert({
        workspace_id: workspaceId,
        entity_type: 'task',
        entity_id: escalation.taskId,
        type: 'risk_escalation',
        status: 'pending',
        metadata: {
          projectId,
          escalationType: escalation.type,
          message: escalation.message
        }
      });
  }
};
