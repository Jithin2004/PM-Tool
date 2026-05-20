import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { sha256 } from '../utils/cryptoUtils';

export interface ActivityLogEntry {
  id?: string;
  workspace_id: string;
  actor_id?: string;
  project_id?: string;
  task_id?: string;
  action: string;
  metadata: Record<string, any>;
  previous_hash?: string;
  hash?: string;
  created_at?: string;
}

export const activityLogService = {
  async getPreviousHash(workspaceId: string): Promise<string> {
    if (!isSupabaseConfigured) return 'GENESIS_BLOCK';
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('hash')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data?.hash) return data.hash;
    } catch (e) {
      console.warn('ActivityLogService: getPreviousHash failed:', e);
    }
    return 'GENESIS_BLOCK';
  },

  async computeHash(entry: Omit<ActivityLogEntry, 'hash' | 'previous_hash'>, previousHash: string): Promise<string> {
    const message = `${entry.workspace_id}${entry.actor_id ?? ''}${entry.project_id ?? ''}${entry.task_id ?? ''}${entry.action}${JSON.stringify(entry.metadata)}${previousHash}${new Date().toISOString()}`;
    return sha256(message);
  },

  async appendLog(entry: Omit<ActivityLogEntry, 'hash' | 'previous_hash' | 'id' | 'created_at'>): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const previousHash = await this.getPreviousHash(entry.workspace_id);
      const hash = await this.computeHash(entry, previousHash);
      const { error } = await supabase.from('activity_logs').insert({
        workspace_id: entry.workspace_id,
        actor_id: entry.actor_id,
        project_id: entry.project_id,
        task_id: entry.task_id,
        action: entry.action,
        metadata: entry.metadata,
        previous_hash: previousHash,
        hash
      });
      if (error) {
        console.error('ActivityLogService: appendLog failed:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('ActivityLogService: appendLog exception:', e);
      return false;
    }
  },

  async getLogs(workspaceId: string, projectId?: string, taskId?: string): Promise<ActivityLogEntry[]> {
    if (!isSupabaseConfigured) return [];
    try {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true });
      if (projectId) query = query.eq('project_id', projectId);
      if (taskId) query = query.eq('task_id', taskId);
      const { data, error } = await query;
      if (!error && data) return data as ActivityLogEntry[];
    } catch (e) {
      console.warn('ActivityLogService: getLogs failed:', e);
    }
    return [];
  },

  async verifyChain(workspaceId: string): Promise<{ valid: boolean; tamperedIndex: number | null }> {
    const logs = await this.getLogs(workspaceId);
    if (logs.length === 0) return { valid: true, tamperedIndex: null };
    let currentPrevHash = 'GENESIS_BLOCK';
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (log.previous_hash !== currentPrevHash) return { valid: false, tamperedIndex: i };
      const recomputed = await this.computeHash(log, log.previous_hash!);
      if (log.hash !== recomputed) return { valid: false, tamperedIndex: i };
      currentPrevHash = log.hash!;
    }
    return { valid: true, tamperedIndex: null };
  }
};
