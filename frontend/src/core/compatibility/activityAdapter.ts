import { supabase } from '../../lib/supabase';
import { ActivityEvent } from '../../services/activityEventService';

export interface LegacyActivityLog {
  id: string;
  workspace_id: string;
  actor_id?: string;
  project_id?: string;
  task_id?: string;
  action: string;
  metadata?: any;
  created_at: string;
}

export const activityAdapter = {
  /**
   * Fetches unified activity stream including both old `activity_logs` and new `activity_events`
   */
  async getUnifiedTimeline(workspaceId: string, limit: number = 50): Promise<ActivityEvent[]> {
    try {
      // 1. Fetch new events
      const { data: newEvents, error: newError } = await supabase
        .from('activity_events')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(limit);

      // 2. Fetch old logs
      const { data: oldLogs, error: oldError } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (newError || oldError) {
        console.error('[activityAdapter] Fetch error', { newError, oldError });
      }

      // 3. Transform old logs into new format
      const transformedOldLogs: ActivityEvent[] = (oldLogs || []).map((log: LegacyActivityLog) => {
        let entityType = 'workspace';
        let entityId = workspaceId;

        if (log.task_id) {
          entityType = 'task';
          entityId = log.task_id;
        } else if (log.project_id) {
          entityType = 'project';
          entityId = log.project_id;
        }

        return {
          id: log.id,
          workspace_id: log.workspace_id,
          actor_id: log.actor_id,
          entity_type: entityType,
          entity_id: entityId,
          action_type: log.action,
          metadata: log.metadata,
          created_at: log.created_at
        };
      });

      // 4. Merge and sort
      const combined = [...(newEvents || []), ...transformedOldLogs];
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return combined.slice(0, limit);
    } catch (err) {
      console.error('[activityAdapter] Unified fetch failed', err);
      return [];
    }
  }
};
