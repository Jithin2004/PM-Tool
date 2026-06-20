import { supabase } from '../lib/supabase';
import { trackSupabaseOperation } from '../core/observability/telemetry';

export interface NotificationEvent {
  id: string;
  workspace_id: string;
  user_id: string;
  type: 'assigned' | 'mentioned' | 'blocked' | 'approval_requested' | 'client_approved' | 'reassigned';
  entity_type: 'task' | 'comment' | 'project' | 'document' | 'invoice';
  entity_id: string;
  read_at: string | null;
  created_at: string;
}

export async function fetchMyNotificationEvents(workspaceId: string): Promise<NotificationEvent[]> {
  const { data, error } = await trackSupabaseOperation('supabase_from_notification_events', () => 
    supabase
      .from('notification_events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(50)
  );

  if (error) throw error;
  return (data || []) as NotificationEvent[];
}

export async function markNotificationEventAsRead(id: string): Promise<void> {
  const { error } = await trackSupabaseOperation('supabase_update_notification_events', () => 
    supabase
      .from('notification_events')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
  );
  if (error) throw error;
}
