import { supabase } from '../lib/supabase';
import { searchIndexService } from './searchIndexService';
import { automationEngine } from '../core/engines/automationEngine';

export interface ActivityEvent {
  id: string;
  workspace_id: string;
  actor_id?: string;
  entity_type: string;
  entity_id: string;
  action_type: string;
  before_value?: any;
  after_value?: any;
  metadata?: Record<string, any>;
  created_at: string;
}

export const activityEventService = {
  async recordActivity(event: Omit<ActivityEvent, 'id' | 'created_at'>): Promise<boolean> {
    const { error } = await supabase
      .from('activity_events')
      .insert({
        id: crypto.randomUUID(),
        ...event,
      });

    if (error) {
      console.error('[activityEventService.recordActivity] Error:', error);
      return false;
    }

    // Fire & forget index sync
    this._tryIndexEvent(event).catch(e => console.error('Search index sync failed:', e));
    
    // Fire & forget automation engine evaluation
    const fullEvent = { id: crypto.randomUUID(), ...event, created_at: new Date().toISOString() };
    automationEngine.evaluateTrigger(fullEvent).catch(e => console.error('Automation engine evaluation failed:', e));

    // Route to external integrations
    this.emitExternalEvent(event.workspace_id, event.entity_type, event.entity_id, event.action_type, event).catch(() => {});

    return true;
  },

  async _tryIndexEvent(event: Omit<ActivityEvent, 'id' | 'created_at'>) {
    const indexedActions = ['created', 'updated', 'task_created', 'task_updated', 'comment_created', 'document_uploaded', 'invoice_created', 'decision_created', 'epic_created', 'document_created', 'document_updated', 'document_version_created', 'document_approved', 'document_shared', 'file_uploaded', 'file_version_created', 'file_shared', 'file_version_restored'];
    
    if (!indexedActions.includes(event.action_type)) return;

    let title = event.metadata?.title || event.metadata?.name || event.after_value?.name || event.after_value?.title;
    let content = event.metadata?.content || event.metadata?.description || event.after_value?.description || event.after_value?.content || event.metadata?.message;

    if (!title && event.action_type === 'comment_created') {
      title = `Comment on ${event.entity_type}`;
    }
    
    if (!title && !content) return; // Not enough context to index purely from the event

    const metadata = { ...event.metadata };
    if (event.after_value?.uid || event.after_value?.project_code || event.after_value?.uid_code) {
        metadata.uid = event.after_value.uid || event.after_value.project_code || event.after_value.uid_code;
    }

    await searchIndexService.indexEntity({
      workspace_id: event.workspace_id,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      title: title || `${event.entity_type} ${event.entity_id.split('-')[0]}`,
      content: content || '',
      metadata
    });
  },

  async getEntityTimeline(entityType: string, entityId: string): Promise<ActivityEvent[]> {
    const { data, error } = await supabase
      .from('activity_events')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[activityEventService.getEntityTimeline] Error:', error);
      return [];
    }
    return data || [];
  },

  async getProjectActivity(projectId: string): Promise<ActivityEvent[]> {
    // This assumes project activity might be tracked natively via entity_type='project' or through metadata
    const { data, error } = await supabase
      .from('activity_events')
      .select('*')
      .or(`and(entity_type.eq.project,entity_id.eq.${projectId}),metadata->>project_id.eq.${projectId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[activityEventService.getProjectActivity] Error:', error);
      return [];
    }
    return data || [];
  },

  async getUserActivity(userId: string): Promise<ActivityEvent[]> {
    const { data, error } = await supabase
      .from('activity_events')
      .select('*')
      .eq('actor_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[activityEventService.getUserActivity] Error:', error);
      return [];
    }
    return data || [];
  },

  /**
   * Async-only hook to emit external integrations out of Resolve PM graph
   */
  async emitExternalEvent(workspaceId: string, entityType: string, entityId: string, actionType: string, payload: any) {
    try {
      // Lazy load to prevent circular dependencies
      const { integrationEngine } = await import('../core/engines/integrationEngine');
      
      const { data: connections } = await supabase
        .from('integration_connections')
        .select('id, provider')
        .eq('workspace_id', workspaceId)
        .eq('status', 'connected');

      if (!connections) return;

      for (const conn of connections) {
        // Fire & forget
        integrationEngine.sendOutgoingEvent(
          workspaceId, 
          conn.id, 
          entityType, 
          entityId, 
          actionType, 
          payload
        ).catch(err => {
          console.error('[emitExternalEvent] Async Integration Engine Error:', err);
        });
      }
    } catch (e) {
      console.error('[emitExternalEvent] Failed to route to Integration Engine:', e);
    }
  }
};
