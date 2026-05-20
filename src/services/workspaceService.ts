import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Workspace, WorkspaceSettings } from '../types/workspace';
import { calendarEventService } from './calendarEventService';
import { getHolidaysForRegion } from '../utils/holidays';

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
  created_at: string;
  updated_at?: string;
}

export function rowToWorkspace(row: WorkspaceRow): Workspace {
  let businessType = 'Software';
  let saturdayRule: WorkspaceSettings['saturdayRule'] = 'off';
  let country = '';
  let region = '';
  let shutdowns: WorkspaceSettings['shutdowns'] = [];

  const rawBusinessType = row.business_type || 'Software';

  if (rawBusinessType.startsWith('{')) {
    try {
      const parsed = JSON.parse(rawBusinessType);
      businessType = parsed.businessType || 'Software';
      saturdayRule = parsed.saturdayRule || 'off';
      country = parsed.country || '';
      region = parsed.region || '';
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
      shutdowns
    }
  };
}

export function settingsToWorkspaceRow(settings: WorkspaceSettings) {
  const meta = {
    businessType: settings.businessType,
    saturdayRule: settings.saturdayRule || 'off',
    country: settings.country || '',
    region: settings.region || '',
    shutdowns: settings.shutdowns || []
  };

  return {
    business_type: JSON.stringify(meta),
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
  if (import.meta.env.DEV) {
    console.log("workspaceService: getWorkspaceForUser() started for user:", userId);
    console.log("workspaceService: getWorkspaceForUser() querying users table...");
  }
  const { data: memberRow, error: memberError } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', userId)
    .maybeSingle();

  if (import.meta.env.DEV) {
    console.log("workspaceService: getWorkspaceForUser() users query completed. error:", memberError, "data:", memberRow);
  }
  if (memberError) throw memberError;

  // 1. Detect zero-row user lookup or missing workspace_id
  if (!memberRow || !memberRow.workspace_id) {
    return null;
  }

  if (import.meta.env.DEV) {
    console.log("workspaceService: getWorkspaceForUser() querying workspaces table for ID:", memberRow.workspace_id);
  }
  const { data: workspaceRow, error: workspaceError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', memberRow.workspace_id)
    .maybeSingle();

  if (import.meta.env.DEV) {
    console.log("workspaceService: getWorkspaceForUser() workspaces query completed. error:", workspaceError, "data:", workspaceRow);
  }
  if (workspaceError) throw workspaceError;
  return workspaceRow ? rowToWorkspace(workspaceRow as WorkspaceRow) : null;
}

export async function syncWorkspaceHolidays(workspaceId: string, country: string, region: string, actorId?: string) {
  if (!country) return;

  const currentYear = new Date().getFullYear();
  const holidays = getHolidaysForRegion(country, region, currentYear);
  const nextYearHolidays = getHolidaysForRegion(country, region, currentYear + 1);
  const allHolidays = [...holidays, ...nextYearHolidays];

  if (allHolidays.length > 0) {
    try {
      const { data: existing } = await supabase
        .from('calendar_events')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('event_type', 'holiday')
        .eq('auto_generated', true);
      if (existing) {
        await supabase.from('calendar_events').update({ deleted_at: new Date().toISOString() }).in('id', existing.map(e => e.id)).is('deleted_at', null);
      }

      for (const h of allHolidays) {
        await calendarEventService.createEvent({
          workspace_id: workspaceId,
          event_type: h.type === 'festival' ? 'festival' : 'holiday',
          title: h.name,
          start_date: `${h.date}T00:00:00Z`,
          end_date: `${h.date}T23:59:59Z`,
          capacity_impact: 1,
          is_recurring: true,
          recurrence_rule: 'FREQ=YEARLY',
          auto_generated: true,
          timezone: 'UTC'
        }, actorId);
      }
    } catch (err) {
      console.error("Failed to sync workspace holidays:", err);
    }
  }
}

export async function createWorkspaceForUser({ name, settings, user, templateId, executionMode, defaultLanes, workflowRules }: CreateWorkspaceInput): Promise<Workspace> {
  const { data: workspaceRow, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({
      name,
      owner_id: user.id,
      template_id: templateId || null,
      execution_mode: executionMode || 'KANBAN',
      default_lanes: defaultLanes || 5,
      workflow_rules: workflowRules || {},
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

  // Initialize a starter project with the chosen execution mode
  const templateName = templateId ? (templateId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())) : 'Blank';
  const { error: projectError } = await supabase
    .from('projects')
    .insert({
      workspace_id: workspaceRow.id,
      owner_id: user.id,
      name: `${templateName} — Kickoff`,
      status: 'planning',
      priority: 'medium',
      template: templateName,
      execution_mode: executionMode || 'KANBAN',
      efficiency: 0.8,
      tags: ['NEW']
    });

  if (projectError) {
    console.warn("Failed to create starter project:", projectError);
  }

  if (settings.country) {
    syncWorkspaceHolidays(workspaceRow.id, settings.country, settings.region || '').catch(err => {
      console.warn("Failed to sync workspace holidays in background:", err);
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
    if (actor.role !== 'super_admin' && actor.id !== workspace.ownerId) throw new Error('Access denied: only super_admin or workspace owner can update settings');
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
      console.warn("Failed to sync workspace holidays in background:", err);
    });
  }

  return rowToWorkspace(data as WorkspaceRow);
}
