import { supabase } from '../lib/supabase';
import {
  fetchProjects,
  fetchWorkspaceProfiles,
  fetchWorkspaceTeams,
  fetchWorkspaceAttendance,
  fetchWorkspaceSalaries,
  fetchWorkspaceSettingsBlob,
} from './operationalDataService';
import type { Project, Profile, Team } from '../types';
import type { AttendanceRow, SalaryRow } from '../core/operational/types';

export interface OperationalSnapshot {
  projects: Project[];
  profiles: Profile[];
  teams: Team[];
  attendanceRows: AttendanceRow[];
  salaryRows: SalaryRow[];
  workspaceSettingsBlob: Record<string, unknown>;
  serverMetrics?: {
    deliveryConfidence: number;
    executionPressure: number;
    dailyFatigue: number;
    riskForecast: number;
  };
}

export async function refreshOperationalSnapshot(workspaceId: string): Promise<OperationalSnapshot> {
  const [projects, profiles, teams, attendanceRows, salaryRows, workspaceSettingsBlob, serverMetricsResult] = await Promise.all([
    fetchProjects(workspaceId),
    fetchWorkspaceProfiles(workspaceId),
    fetchWorkspaceTeams(workspaceId),
    fetchWorkspaceAttendance(workspaceId),
    fetchWorkspaceSalaries(workspaceId),
    fetchWorkspaceSettingsBlob(workspaceId),
    supabase.rpc('get_operational_intelligence', { p_workspace_id: workspaceId }),
  ]);

  return { 
    projects, 
    profiles, 
    teams, 
    attendanceRows, 
    salaryRows, 
    workspaceSettingsBlob, 
    serverMetrics: serverMetricsResult?.data || undefined 
  };
}

export async function refreshOperationalPartial(
  workspaceId: string,
  keys: Array<keyof OperationalSnapshot>,
): Promise<Partial<OperationalSnapshot>> {
  const loaders: Record<keyof OperationalSnapshot, () => Promise<unknown>> = {
    projects: () => fetchProjects(workspaceId),
    profiles: () => fetchWorkspaceProfiles(workspaceId),
    teams: () => fetchWorkspaceTeams(workspaceId),
    attendanceRows: () => fetchWorkspaceAttendance(workspaceId),
    salaryRows: () => fetchWorkspaceSalaries(workspaceId),
    workspaceSettingsBlob: () => fetchWorkspaceSettingsBlob(workspaceId),
    serverMetrics: () => supabase.rpc('get_operational_intelligence', { p_workspace_id: workspaceId }).then(r => r.data),
  };

  const entries = await Promise.all(keys.map(async key => [key, await loaders[key]()]));
  return Object.fromEntries(entries) as Partial<OperationalSnapshot>;
}
