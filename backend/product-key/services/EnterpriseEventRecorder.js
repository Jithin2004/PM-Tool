const { supabaseAdmin } = require('../lib/supabase');
const crypto = require('crypto');

class EnterpriseEventRecorder {
  static async recordEvent(event) {
    if (!supabaseAdmin) {
      console.warn('[EnterpriseEventRecorder] supabaseAdmin not initialized. Skipping.');
      return false;
    }

    try {
      const canonicalEvent = {
        id: event.event_id || crypto.randomUUID(),
        workspace_id: event.workspace_id,
        user_id: event.user_id || null,
        actor_id: event.user_id || null, // Keep actor_id for DB compatibility
        actor_name: event.actor_name || 'System',
        actor_avatar: event.actor_avatar || null,
        entity_type: event.entity_type,
        entity_id: event.entity_id || null,
        action: event.verb, // Match 'action' column
        verb: event.verb,
        title: event.title,
        description: event.description || null,
        severity: event.severity || 'low',
        importance: event.importance || 'info',
        icon_key: event.icon_key || 'info',
        metadata: event.metadata || {},
        ip_address: event.ip_address || '127.0.0.1',
        device: event.device || 'server',
        workspace_timezone: event.workspace_timezone || 'UTC',
        display_time: event.display_time || new Date().toISOString(),
        created_at: event.created_at || new Date().toISOString(),
        correlation_id: event.correlation_id || null,
        run_id: event.run_id || null,
        is_system: event.is_system !== undefined ? event.is_system : true,
        visibility: event.visibility || 'public',
        origin: event.origin || 'backend',
        module: event.module || 'system',
        event_version: event.event_version || 1,
        event_hash: event.event_hash || null,
        action_type: event.verb // Keep action_type for DB compatibility
      };

      // Handle idempotency/duplicate protection if event_hash is provided
      if (canonicalEvent.event_hash) {
        const { data: existing } = await supabaseAdmin
          .from('activity_events')
          .select('id')
          .eq('event_hash', canonicalEvent.event_hash)
          .maybeSingle();
        if (existing) {
          console.log(`[EnterpriseEventRecorder] Duplicate event detected for hash: ${canonicalEvent.event_hash}. Skipping.`);
          return true;
        }
      }

      const { error } = await supabaseAdmin
        .from('activity_events')
        .insert(canonicalEvent);

      if (error) {
        console.error('[EnterpriseEventRecorder] Error inserting event to database:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[EnterpriseEventRecorder] Error recording event:', err);
      return false;
    }
  }
}

module.exports = EnterpriseEventRecorder;
