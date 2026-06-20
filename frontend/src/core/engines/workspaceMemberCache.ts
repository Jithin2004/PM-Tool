import { supabase } from '../../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface WorkspaceMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

class WorkspaceMemberCache {
  private cache: Record<string, WorkspaceMember[]> = {};
  private loading: Record<string, boolean> = {};
  private channel: RealtimeChannel | null = null;
  private currentWorkspaceId: string | null = null;

  async hydrate(workspaceId: string, force = false): Promise<WorkspaceMember[]> {
    if (!workspaceId) return [];
    if (!force && this.cache[workspaceId]) return this.cache[workspaceId];
    if (this.loading[workspaceId]) {
      // Basic lock: wait for existing hydration
      while (this.loading[workspaceId]) {
        await new Promise(r => setTimeout(r, 50));
      }
      return this.cache[workspaceId] || [];
    }

    this.loading[workspaceId] = true;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active'); // Only active members

      if (!error && data) {
        this.cache[workspaceId] = data;
        return data;
      }
      return [];
    } finally {
      this.loading[workspaceId] = false;
    }
  }

  getMembers(workspaceId: string): WorkspaceMember[] {
    return this.cache[workspaceId] || [];
  }

  async searchMembers(workspaceId: string, query: string): Promise<WorkspaceMember[]> {
    const members = await this.hydrate(workspaceId);
    if (!query) return members.slice(0, 10);
    
    const q = query.toLowerCase();
    return members.filter(m => {
      const emailPrefix = (m.email || '').split('@')[0].toLowerCase();
      const nameJoined = (m.full_name || '').replace(/\s+/g, '').toLowerCase();
      const fullName = (m.full_name || '').toLowerCase();
      
      return emailPrefix.includes(q) || nameJoined.includes(q) || fullName.includes(q);
    }).slice(0, 10);
  }

  invalidateCache(workspaceId?: string) {
    if (workspaceId) {
      delete this.cache[workspaceId];
    } else {
      this.cache = {};
    }
  }

  initializeRealtimeSync(workspaceId: string) {
    if (!workspaceId) return;
    
    // Prevent duplicate subscriptions
    if (this.currentWorkspaceId === workspaceId && this.channel) {
      return;
    }
    
    // Clean up existing before creating new
    this.destroy();
    
    this.currentWorkspaceId = workspaceId;

    this.channel = supabase.channel(`public:users:workspace_${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `workspace_id=eq.${workspaceId}`
        },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldRecord = payload.old as { id: string };
            if (this.cache[workspaceId]) {
              this.cache[workspaceId] = this.cache[workspaceId].filter(m => m.id !== oldRecord.id);
            }
          } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Update role/capabilities instantly by rehydrating
            // Alternatively, could modify the array in place, but a rehydrate is safer for full consistency.
            this.invalidateCache(workspaceId);
            await this.hydrate(workspaceId);
          }
        }
      )
      .subscribe();
  }

  destroy() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.currentWorkspaceId = null;
    this.invalidateCache();
  }
}

export const workspaceMemberCache = new WorkspaceMemberCache();
