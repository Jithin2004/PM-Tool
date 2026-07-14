import { supabase } from '../lib/supabase';
import { resolveWorkingTimezone } from '../utils/timeIntelligence';

export interface EnterpriseEventInput {
  workspace_id: string;
  user_id?: string;
  actor_name?: string;
  actor_avatar?: string;
  entity_type: string;
  entity_id?: string;
  verb: string;
  title: string;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  importance: 'info' | 'normal' | 'important' | 'critical';
  icon_key: string;
  metadata?: Record<string, any>;
  visibility: 'public' | 'admin' | 'private';
  module: string;
  event_hash?: string;
}

let cachedProfile: { id: string; name: string; avatar: string } | null = null;

function getDeviceDetails(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';

  let os = 'Unknown OS';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return `${browser} on ${os}`;
}

export const enterpriseEventPublisher = {
  async publish(event: EnterpriseEventInput): Promise<boolean> {
    try {
      // 1. Resolve User and Profile details
      let actorId = event.user_id;
      let actorName = event.actor_name;
      let actorAvatar = event.actor_avatar;

      if (!actorId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          actorId = session.user.id;
          if (cachedProfile && cachedProfile.id === actorId) {
            actorName = cachedProfile.name;
            actorAvatar = cachedProfile.avatar;
          } else {
            const { data: profile } = await supabase
              .from('users')
              .select('full_name, avatar_url')
              .eq('id', actorId)
              .maybeSingle();
            
            if (profile) {
              actorName = profile.full_name || session.user.email?.split('@')[0] || 'User';
              actorAvatar = profile.avatar_url;
              cachedProfile = { id: actorId, name: actorName, avatar: actorAvatar || '' };
            }
          }
        }
      }

      // 2. Fetch context information (device, correlation/run IDs, timezone)
      const device = getDeviceDetails();
      const correlationId = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('resolve_pm_correlation_id') || null : null;
      const runId = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('resolve_pm_run_id') || null : null;
      
      const tz = resolveWorkingTimezone();
      const localNow = new Date();
      // Formatted display time
      const displayTime = localNow.toISOString();

      // 3. Assemble Canonical Event Model
      const canonicalEvent = {
        id: crypto.randomUUID(),
        workspace_id: event.workspace_id,
        user_id: actorId || null,
        actor_id: actorId || null, // Keep actor_id for DB compatibility
        actor_name: actorName || 'System',
        actor_avatar: actorAvatar || null,
        entity_type: event.entity_type,
        entity_id: event.entity_id || null,
        action: event.verb, // Match 'action' column
        verb: event.verb,
        title: event.title,
        description: event.description || null,
        severity: event.severity,
        importance: event.importance,
        icon_key: event.icon_key,
        metadata: event.metadata || {},
        ip_address: 'client-side', // Authoritative IP will be written/overwritten where possible
        device,
        workspace_timezone: tz,
        display_time: displayTime,
        created_at: localNow.toISOString(),
        correlation_id: correlationId,
        run_id: runId,
        is_system: !actorId,
        visibility: event.visibility,
        origin: 'frontend',
        module: event.module,
        event_version: 1,
        event_hash: event.event_hash || null,
        action_type: event.verb // Keep action_type for DB compatibility
      };

      // 4. Duplicate Event Prevention / Idempotency Check
      if (canonicalEvent.event_hash) {
        const { data: existing } = await supabase
          .from('activity_events')
          .select('id')
          .eq('event_hash', canonicalEvent.event_hash)
          .maybeSingle();

        if (existing) {
          console.warn(`[EnterpriseEventPublisher] Duplicate event detected for hash: ${canonicalEvent.event_hash}. Skipping.`);
          return true;
        }
      }

      // 5. Insert to Supabase activity_events
      const { error } = await supabase
        .from('activity_events')
        .insert(canonicalEvent);

      if (error) {
        console.error('[EnterpriseEventPublisher] Error publishing event to database:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[EnterpriseEventPublisher] Failed to publish event:', err);
      return false;
    }
  }
};
