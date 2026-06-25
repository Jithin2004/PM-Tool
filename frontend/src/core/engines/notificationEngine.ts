import { supabase } from '../../lib/supabase';
import { activityAggregationService } from '../../services/activityAggregationService';

export const notificationEngine = {
  async createNotification(workspaceId: string, recipientId: string, sourceEventId: string | null, entityType: string, entityId: string, priority: 'low'|'normal'|'high'|'critical', category: string, title: string, message: string, actionUrl: string) {
    const { data, error } = await supabase.from('notification_events').insert({
      workspace_id: workspaceId,
      recipient_id: recipientId,
      source_event_id: sourceEventId,
      entity_type: entityType,
      entity_id: entityId,
      priority,
      category,
      title,
      message,
      action_url: actionUrl
    }).select().single();

    if (error) console.error("Failed to create notification", error);
    return data;
  },

  async notifyOwners(workspaceId: string, title: string, message: string) {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('workspace_id', workspaceId)
      .in('role', ['owner', 'admin', 'super_admin']);
      
    if (users) {
      for (const u of users) {
        await this.createNotification(workspaceId, u.user_id, null, 'integration', 'global', 'high', 'system', title, message, '/workspace/integrations');
      }
    }
  },

  async processActivityEvent(event: any) {
    // Translate raw activity events to user notifications
    // e.g. task assigned, blocker created, etc.
    if (event.event_type === 'task_assigned' && event.metadata?.assignee_id) {
      await this.createNotification(
        event.workspace_id,
        event.metadata.assignee_id,
        event.id,
        'task',
        event.entity_id,
        'high',
        'task',
        'Task Assigned',
        `You have been assigned to task: ${event.metadata.task_name || 'New Task'}`,
        `/workspace/board?task=${event.entity_id}`
      );
    }

    if (event.event_type === 'mention' && event.metadata?.mentioned_user_id) {
      await this.createNotification(
        event.workspace_id,
        event.metadata.mentioned_user_id,
        event.id,
        event.entity_type,
        event.entity_id,
        'high',
        'system',
        'You were mentioned',
        `${event.metadata.author_name} mentioned you.`,
        `/workspace/board?task=${event.entity_id}`
      );
    }
    
    // Aggregation logic placeholder for delayed tasks
    if (event.event_type === 'timeline_delayed') {
      // Logic would group these in batch or create a single PM notification
    }
  },

  async routeNotification(workspaceId: string, type: 'finance_shortage' | 'project_risk' | 'leave_approval_result' | 'critical_blocker', data: any) {
    // Determine recipients based on role/type
    if (type === 'critical_blocker') {
      // Find PM and Assignee
      // Simplified mock insertion
      if (data.assigneeId) {
        await this.createNotification(workspaceId, data.assigneeId, null, 'task', data.taskId, 'critical', 'risk', 'Critical Blocker', data.message, `/workspace/board`);
      }
      if (data.pmId) {
        await this.createNotification(workspaceId, data.pmId, null, 'task', data.taskId, 'critical', 'risk', 'Critical Blocker Reported', data.message, `/workspace/board`);
      }
    }
    
    if (type === 'finance_shortage') {
      // Get Owners and Finance
      const { data: users } = await supabase.from('users').select('id, role').eq('workspace_id', workspaceId).in('role', ['owner', 'admin']);
      for (const u of (users || [])) {
        await this.createNotification(workspaceId, u.id, null, 'finance', 'global', 'critical', 'finance', 'Cash Shortage Detected', data.message, `/workspace/finance/command-center`);
      }
    }
  },

  async markRead(notificationId: string, userId: string) {
    await supabase.from('notification_events')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('recipient_id', userId);
  },

  async markAllRead(workspaceId: string, userId: string) {
    await supabase.from('notification_events')
      .update({ read_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .eq('recipient_id', userId)
      .is('read_at', null);
  },

  async generateDigest(workspaceId: string, userId: string) {
    // Generate daily summary from reportingEngine
    // Mock digest implementation
    const text = "Yesterday: 8 tasks completed, 2 blockers, Sprint risk +10%";
    await this.createNotification(workspaceId, userId, null, 'system', 'digest', 'normal', 'system', 'Daily Digest', text, '/workspace/reports');
  },

  async loadWorkspaceNotifications(workspaceId: string, userId?: string) {
    let query = supabase
      .from('notification_events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('recipient_id', userId);
    }
    const { data } = await query;
    return data || [];
  },

  subscribeToWorkspaceNotifications(workspaceId: string, userId: string | undefined, onInsert: (row: any) => void) {
    const channel = supabase.channel(`notifications-changes-${workspaceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notification_events', filter: `workspace_id=eq.${workspaceId}` }, payload => {
        const row = payload.new;
        if (!row.recipient_id || row.recipient_id === userId) {
          onInsert(row);
          if (userId) {
            import('../../services/notificationPreferenceService').then(({ handleIncomingNotification }) => {
              handleIncomingNotification(userId, row.title, row.message || '');
            });
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
