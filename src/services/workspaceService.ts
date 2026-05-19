import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Workspace, WorkspaceSettings } from '../types/workspace';

export interface CreateWorkspaceInput {
  name: string;
  settings: WorkspaceSettings;
  user: User;
}

interface WorkspaceRow {
  id: string;
  name: string;
  owner_id: string;
  business_type: WorkspaceSettings['businessType'];
  work_start: string;
  work_end: string;
  lunch_duration: number;
  workdays: number[];
  timezone: string;
  attendance_enabled: boolean;
  payroll_enabled: boolean;
  productivity_factor: number;
  created_at: string;
  updated_at?: string;
}

export function rowToWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    settings: {
      businessType: row.business_type,
      workStart: row.work_start?.slice(0, 5) || '09:00',
      workEnd: row.work_end?.slice(0, 5) || '17:00',
      lunchDuration: Number(row.lunch_duration ?? 60),
      workingDays: row.workdays || [1, 2, 3, 4, 5],
      timezone: row.timezone || 'UTC',
      attendanceEnabled: !!row.attendance_enabled,
      payrollEnabled: !!row.payroll_enabled,
      productivityFactor: Number(row.productivity_factor ?? 0.8)
    }
  };
}

export function settingsToWorkspaceRow(settings: WorkspaceSettings) {
  return {
    business_type: settings.businessType,
    work_start: settings.workStart,
    work_end: settings.workEnd,
    lunch_duration: settings.lunchDuration,
    workdays: settings.workingDays,
    timezone: settings.timezone,
    attendance_enabled: settings.attendanceEnabled,
    payroll_enabled: settings.payrollEnabled,
    productivity_factor: settings.productivityFactor
  };
}

export async function getWorkspaceForUser(userId: string): Promise<Workspace | null> {
  console.log("workspaceService: getWorkspaceForUser() started for user:", userId);
  
  console.log("workspaceService: getWorkspaceForUser() querying users table...");
  const { data: memberRow, error: memberError } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', userId)
    .maybeSingle();

  console.log("workspaceService: getWorkspaceForUser() users query completed. error:", memberError, "data:", memberRow);
  if (memberError) throw memberError;
  if (!memberRow?.workspace_id) return null;

  console.log("workspaceService: getWorkspaceForUser() querying workspaces table for ID:", memberRow.workspace_id);
  const { data: workspaceRow, error: workspaceError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', memberRow.workspace_id)
    .maybeSingle();

  console.log("workspaceService: getWorkspaceForUser() workspaces query completed. error:", workspaceError, "data:", workspaceRow);
  if (workspaceError) throw workspaceError;
  return workspaceRow ? rowToWorkspace(workspaceRow as WorkspaceRow) : null;
}

export async function createWorkspaceForUser({ name, settings, user }: CreateWorkspaceInput): Promise<Workspace> {
  const { data: workspaceRow, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({
      name,
      owner_id: user.id,
      ...settingsToWorkspaceRow(settings)
    })
    .select()
    .single();

  if (workspaceError) throw workspaceError;

  const email = user.email || '';
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0] || 'Workspace Owner';
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

  const { error: userError } = await supabase
    .from('users')
    .upsert({
      id: user.id,
      workspace_id: workspaceRow.id,
      email,
      full_name: fullName,
      avatar_url: avatarUrl,
      role: 'super_admin',
      availability_factor: 1
    });

  if (userError) throw userError;

  return rowToWorkspace(workspaceRow as WorkspaceRow);
}

export async function updateWorkspaceSettings(workspace: Workspace, settings: Partial<WorkspaceSettings>): Promise<Workspace> {
  const nextSettings = { ...workspace.settings, ...settings };
  const { data, error } = await supabase
    .from('workspaces')
    .update(settingsToWorkspaceRow(nextSettings))
    .eq('id', workspace.id)
    .select()
    .single();

  if (error) throw error;
  return rowToWorkspace(data as WorkspaceRow);
}
