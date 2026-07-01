import { LifecycleAwareService, AppContext } from '../lifecycle/types';
import { supabase } from '../../lib/supabase';

let _presenceStatus: 'idle' | 'running' | 'paused' | 'error' = 'idle';
let globalPresenceContext = {
  userId: null as string | null,
  workspaceId: null as string | null
};
let presenceChannel: any = null;

export const PresenceService: LifecycleAwareService = {
  initialize: (context: AppContext) => {
    globalPresenceContext.userId = context.user?.id || null;
    globalPresenceContext.workspaceId = context.workspace?.id || null;
    _presenceStatus = 'running';

    if (globalPresenceContext.workspaceId && globalPresenceContext.userId) {
      presenceChannel = supabase.channel(`workspace-presence-${globalPresenceContext.workspaceId}`);
      presenceChannel
        .on('presence', { event: 'sync' }, () => {})
        .on('presence', { event: 'join' }, () => {})
        .on('presence', { event: 'leave' }, () => {})
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({
              user_id: globalPresenceContext.userId,
              online_at: new Date().toISOString(),
            });
          }
        });
    }
  },
  
  pause: () => { 
    _presenceStatus = 'paused'; 
  },
  
  resume: () => { 
    _presenceStatus = 'running'; 
  },
  
  dispose: () => {
    if (presenceChannel) {
      supabase.removeChannel(presenceChannel);
      presenceChannel = null;
    }
    globalPresenceContext = { userId: null, workspaceId: null };
    _presenceStatus = 'idle';
  },
  
  getStatus: () => _presenceStatus
};
