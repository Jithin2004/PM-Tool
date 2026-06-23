import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Workspace, WorkspaceSettings } from '../types/workspace';
import { calendarEventService } from './calendarEventService';
import { companyCalendarService } from './companyCalendarService';
import { hasCapability } from '../core/auth/permissions';
import { reconcileWorkspaceMembership } from '../core/auth/reconcileInvitationMembership';
import type { UserRole } from '../types';

export interface CreateWorkspaceInput {
  name: string;
  settings: WorkspaceSettings;
  user: User;
  templateId?: string;
  executionMode?: string;
  defaultLanes?: number;
  workflowRules?: Record<string, any>;
}

interface WorkspaceRow {
  id: string;
  name: string;
  owner_id: string;
  business_type: WorkspaceSettings['businessType'];
  template_id?: string;
  execution_mode?: string;
  default_lanes?: number;
  workflow_rules?: Record<string, any>;
  work_start: string;
  work_end: string;
  lunch_duration: number;
  workdays: number[];
  timezone: string;
  attendance_enabled: boolean;
  payroll_enabled: boolean;
  productivity_factor: number;
  is_demo?: boolean;
  is_sandbox?: boolean;
  parent_workspace_id?: string;
  status?: string;
  metadata?: any;
  created_at: string;
  updated_at?: string;
}

export function rowToWorkspace(row: WorkspaceRow): Workspace {
  let businessType = 'Software';
  let saturdayRule: WorkspaceSettings['saturdayRule'] = 'off';
  let country = '';
  let region = '';
  let city = '';
  let companyName = '';
  let logoUrl = '';
  let shutdowns: WorkspaceSettings['shutdowns'] = [];

  const rawBusinessType = row.business_type || 'Software';

  if (rawBusinessType.startsWith('{')) {
    try {
      const parsed = JSON.parse(rawBusinessType);
      businessType = parsed.businessType || 'Software';
      saturdayRule = parsed.saturdayRule || 'off';
      country = parsed.country || '';
      region = parsed.region || '';
      city = parsed.city || '';
      companyName = parsed.companyName || '';
      logoUrl = parsed.logoUrl || '';
      shutdowns = parsed.shutdowns || [];
    } catch (err) {
      // Fallback
    }
  } else if (rawBusinessType.includes('|')) {
    const parts = rawBusinessType.split('|');
    businessType = parts[0];
    saturdayRule = parts[1] as any;
  } else {
    businessType = rawBusinessType;
    const days = row.workdays || [];
    if (days.includes(6)) {
      saturdayRule = 'all';
    } else {
      saturdayRule = 'off';
    }
  }

  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    is_demo: row.is_demo,
    is_sandbox: row.is_sandbox,
    parent_workspace_id: row.parent_workspace_id,
    status: row.status as any || 'active',
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    settings: {
      businessType: businessType as any,
      templateId: row.template_id,
      executionMode: row.execution_mode,
      defaultLanes: row.default_lanes,
      workflowRules: row.workflow_rules,
      workStart: row.work_start?.slice(0, 5) || '09:00',
      workEnd: row.work_end?.slice(0, 5) || '17:00',
      lunchDuration: Number(row.lunch_duration ?? 60),
      workingDays: row.workdays || [1, 2, 3, 4, 5],
      timezone: row.timezone || 'UTC',
      attendanceEnabled: !!row.attendance_enabled,
      payrollEnabled: !!row.payroll_enabled,
      productivityFactor: Number(row.productivity_factor ?? 0.8),
      saturdayRule,
      country,
      region,
      city,
      companyName,
      logoUrl,
      shutdowns,
      passwordPolicy: typeof row.metadata === 'object' ? row.metadata?.passwordPolicy : undefined,
      magicLinkExpiry: typeof row.metadata === 'object' ? row.metadata?.magicLinkExpiry : undefined,
      baseCurrency: typeof row.metadata === 'object' ? row.metadata?.baseCurrency : undefined,
    }
  };
}

export function settingsToWorkspaceRow(settings: WorkspaceSettings) {
  const meta = {
    businessType: settings.businessType || 'Software',
    saturdayRule: settings.saturdayRule || 'off',
    country: settings.country || '',
    region: settings.region || '',
    city: settings.city || '',
    companyName: settings.companyName || '',
    logoUrl: settings.logoUrl || '',
    shutdowns: settings.shutdowns || []
  };

  const workStart = settings.workStart || settings.workingTimeFrom || '09:00';
  const workEnd = settings.workEnd || settings.workingTimeTo || '17:00';

  return {
    business_type: JSON.stringify(meta),
    execution_mode: settings.executionMode || settings.default_mode || 'KANBAN',
    work_start: workStart,
    work_end: workEnd,
    lunch_duration: settings.lunchDuration !== undefined ? settings.lunchDuration : 60,
    workdays: settings.workingDays || [1, 2, 3, 4, 5],
    timezone: settings.timezone || 'UTC',
    attendance_enabled: settings.attendanceEnabled !== undefined ? settings.attendanceEnabled : true,
    payroll_enabled: settings.payrollEnabled !== undefined ? settings.payrollEnabled : false,
    productivity_factor: settings.productivityFactor !== undefined ? settings.productivityFactor : 0.8,
    metadata: {
      passwordPolicy: settings.passwordPolicy,
      magicLinkExpiry: settings.magicLinkExpiry,
      baseCurrency: settings.baseCurrency,
      ...settings // Let it store any other miscellaneous flags
    }
  };
}

export async function getWorkspaceForUser(userId: string): Promise<Workspace | null> {
  if (import.meta.env.DEV) {
  }
  const { data: memberRow, error: memberError } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', userId)
    .maybeSingle();

  if (import.meta.env.DEV) {
  }
  if (memberError) throw memberError;

  // 1. Detect zero-row user lookup or missing workspace_id
  if (!memberRow || !memberRow.workspace_id) {
    return null;
  }

  if (import.meta.env.DEV) {
  }
  const { data: workspaceRow, error: workspaceError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', memberRow.workspace_id)
    .maybeSingle();

  if (import.meta.env.DEV) {
  }
  if (workspaceError) throw workspaceError;
  return workspaceRow ? rowToWorkspace(workspaceRow as WorkspaceRow) : null;
}

export async function syncWorkspaceHolidays(workspaceId: string, country: string, region: string, actorId?: string) {
  await companyCalendarService.syncHolidays(workspaceId, country, region);
}

export async function createWorkspaceForUser({ name, settings, user, templateId, executionMode, defaultLanes, workflowRules }: CreateWorkspaceInput): Promise<Workspace> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authData.user) {
    throw new Error('Your session has expired or is invalid. Please refresh the page and log in again.');
  }
  
  const validOwnerId = authData.user.id;

  const newWorkspaceId = crypto.randomUUID();
  const workspaceData = {
    id: newWorkspaceId,
    name,
    owner_id: validOwnerId,
    template_id: templateId || null,
    execution_mode: executionMode || 'KANBAN',
    default_lanes: defaultLanes || 5,
    workflow_rules: workflowRules || {},
    ...settingsToWorkspaceRow(settings)
  };

  const { error: workspaceError } = await supabase
    .from('workspaces')
    .insert(workspaceData);

  if (workspaceError) throw workspaceError;
  const workspaceRow = workspaceData;

  const email = user.email || authData.user?.email || '';
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || authData.user?.user_metadata?.full_name || email.split('@')[0] || 'Workspace Owner';
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || authData.user?.user_metadata?.avatar_url || null;

  const { error: userError } = await supabase
    .from('users')
    .update({
      workspace_id: workspaceRow.id,
      email,
      full_name: fullName,
      avatar_url: avatarUrl,
      role: 'super_admin',
      availability_factor: 1
    })
    .eq('id', validOwnerId);

  if (userError) throw userError;

  if (settings.country) {
    syncWorkspaceHolidays(workspaceRow.id, settings.country, settings.region || '').catch(err => {
    });
  }

  return rowToWorkspace(workspaceRow as WorkspaceRow);
}

export async function updateWorkspaceSettings(workspace: Workspace, settings: Partial<WorkspaceSettings>, actorId?: string): Promise<Workspace> {
  if (actorId) {
    const { data: actor, error: actorError } = await supabase
      .from('users')
      .select('id, role, workspace_id')
      .eq('id', actorId)
      .maybeSingle();

    if (actorError || !actor) throw new Error('Access denied: actor not found');
    if (actor.workspace_id !== workspace.id) throw new Error('Access denied: cross-workspace operation');
    if (!hasCapability(actor.role as UserRole, 'settings.manage') && actor.id !== workspace.ownerId) {
      throw new Error('Access denied: manage_settings capability required to update workspace settings');
    }
  }

  const nextSettings = { ...workspace.settings, ...settings };
  const { data, error } = await supabase
    .from('workspaces')
    .update(settingsToWorkspaceRow(nextSettings))
    .eq('id', workspace.id)
    .select()
    .single();

  if (error) throw error;

  if (settings.country !== undefined || settings.region !== undefined) {
    syncWorkspaceHolidays(workspace.id, nextSettings.country || '', nextSettings.region || '').catch(err => {
    });
  }

  return rowToWorkspace(data as WorkspaceRow);
}

export async function repairUserWorkspace(userId: string, email?: string): Promise<{ repaired: boolean; workspaceId: string | null; reason: string }> {
  return reconcileWorkspaceMembership(userId, email);
}

export async function cloneWorkspaceToSandbox(workspaceId: string, userId: string): Promise<string> {
  const { data: sandboxId, error } = await supabase.rpc('clone_workspace_to_sandbox', {
    p_workspace_id: workspaceId,
    p_user_id: userId
  });

  if (error) throw error;
  
  const { error: updateError } = await supabase
    .from('users')
    .update({ workspace_id: sandboxId })
    .eq('id', userId);

  if (updateError) throw updateError;
  return sandboxId;
}


