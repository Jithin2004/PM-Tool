import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';

interface WorkspaceExport {
  version: number;
  exportedAt: string;
  workspaceId: string;
  projects: any[];
  tasks: any[];
  users: any[];
  teams: any[];
  webhooks: any[];
  integrations: any[];
  activityLogs: any[];
  taskDependencies: any[];
}

export async function exportWorkspace(wsId: string): Promise<WorkspaceExport | null> {
  if (!isSupabaseConfigured || !wsId) return null;

  const [projects, tasks, users, teams, webhooks, integrations, activityLogs, taskDependencies] = await Promise.all([
    supabase.from('projects').select('*').eq('workspace_id', wsId),
    supabase.from('tasks').select('*').eq('workspace_id', wsId),
    supabase.from('users').select('*').eq('workspace_id', wsId),
    supabase.from('teams').select('*').eq('workspace_id', wsId),
    supabase.from('webhooks').select('*').eq('workspace_id', wsId),
    supabase.from('connected_accounts').select('*').eq('workspace_id', wsId),
    supabase.from('activity_logs').select('*').eq('workspace_id', wsId),
    supabase.from('task_dependencies').select('*').eq('workspace_id', wsId),
  ]);

  const pack: WorkspaceExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    workspaceId: wsId,
    projects: projects.data || [],
    tasks: tasks.data || [],
    users: users.data || [],
    teams: teams.data || [],
    webhooks: webhooks.data || [],
    integrations: integrations.data || [],
    activityLogs: activityLogs.data || [],
    taskDependencies: taskDependencies.data || [],
  };

  await activityLogService.appendLog({
    workspace_id: wsId, action: 'workspace_exported',
    metadata: {
      projects: pack.projects.length, tasks: pack.tasks.length,
      users: pack.users.length, exported_at: pack.exportedAt,
    },
  });

  return pack;
}

export function validateExport(data: unknown): data is WorkspaceExport {
  if (!data || typeof data !== 'object') return false;
  const p = data as Record<string, unknown>;
  return (
    p.version === 1 &&
    typeof p.exportedAt === 'string' &&
    typeof p.workspaceId === 'string' &&
    Array.isArray(p.projects) &&
    Array.isArray(p.tasks) &&
    Array.isArray(p.users) &&
    Array.isArray(p.teams) &&
    Array.isArray(p.webhooks) &&
    Array.isArray(p.integrations) &&
    Array.isArray(p.activityLogs) &&
    Array.isArray(p.taskDependencies)
  );
}

export async function importWorkspace(data: unknown): Promise<{ success: boolean; imported: number; errors: string[] }> {
  const result = { success: false, imported: 0, errors: [] as string[] };
  if (!validateExport(data)) {
    result.errors.push('Invalid export format');
    return result;
  }
  const pack = data as WorkspaceExport;
  const wsId = pack.workspaceId;

  if (!isSupabaseConfigured) {
    result.errors.push('Supabase not configured');
    return result;
  }

  const upsertConfig = { onConflict: 'id' };

  try {
    if (pack.users.length) {
      const { error } = await supabase.from('users').upsert(pack.users, upsertConfig);
      if (error) result.errors.push(`users: ${error.message}`);
      else result.imported += pack.users.length;
    }

    if (pack.teams.length) {
      const { error } = await supabase.from('teams').upsert(pack.teams, upsertConfig);
      if (error) result.errors.push(`teams: ${error.message}`);
      else result.imported += pack.teams.length;
    }

    if (pack.projects.length) {
      const { error } = await supabase.from('projects').upsert(pack.projects, upsertConfig);
      if (error) result.errors.push(`projects: ${error.message}`);
      else result.imported += pack.projects.length;
    }

    if (pack.tasks.length) {
      const { error } = await supabase.from('tasks').upsert(pack.tasks, upsertConfig);
      if (error) result.errors.push(`tasks: ${error.message}`);
      else result.imported += pack.tasks.length;
    }

    if (pack.taskDependencies.length) {
      const { error } = await supabase.from('task_dependencies').upsert(pack.taskDependencies, upsertConfig);
      if (error) result.errors.push(`task_dependencies: ${error.message}`);
      else result.imported += pack.taskDependencies.length;
    }

    if (pack.webhooks.length) {
      const { error } = await supabase.from('webhooks').upsert(pack.webhooks, upsertConfig);
      if (error) result.errors.push(`webhooks: ${error.message}`);
      else result.imported += pack.webhooks.length;
    }

    if (pack.integrations.length) {
      const { error } = await supabase.from('connected_accounts').upsert(pack.integrations, upsertConfig);
      if (error) result.errors.push(`integrations: ${error.message}`);
      else result.imported += pack.integrations.length;
    }

    if (pack.activityLogs.length) {
      const { error } = await supabase.from('activity_logs').upsert(pack.activityLogs, upsertConfig);
      if (error) result.errors.push(`activity_logs: ${error.message}`);
      else result.imported += pack.activityLogs.length;
    }

    await activityLogService.appendLog({
      workspace_id: wsId, action: 'workspace_imported',
      metadata: { imported: result.imported, errors: result.errors.length },
    });

    result.success = true;
  } catch (e: any) {
    result.errors.push(e.message);
  }

  return result;
}
