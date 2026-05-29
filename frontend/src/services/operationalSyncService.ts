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
  const safeFetch = async <T>(promise: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await promise;
    } catch (err) {
      console.warn('[operationalSyncService] Partial failure caught:', err);
      return fallback;
    }
  };

  const [projects, profiles, teams, attendanceRows, salaryRows, workspaceSettingsBlob, serverMetricsResult] = await Promise.all([
    safeFetch(fetchProjects(workspaceId), []),
    safeFetch(fetchWorkspaceProfiles(workspaceId), []),
    safeFetch(fetchWorkspaceTeams(workspaceId), []),
    safeFetch(fetchWorkspaceAttendance(workspaceId), []),
    safeFetch(fetchWorkspaceSalaries(workspaceId), []),
    safeFetch(fetchWorkspaceSettingsBlob(workspaceId), {}),
    safeFetch(supabase.rpc('get_operational_intelligence', { p_workspace_id: workspaceId }), { data: undefined }),
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
  const safeFetch = async <T>(promise: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await promise;
    } catch (err) {
      console.warn('[operationalSyncService] Partial failure caught:', err);
      return fallback;
    }
  };

  const loaders: Record<keyof OperationalSnapshot, () => Promise<unknown>> = {
    projects: () => safeFetch(fetchProjects(workspaceId), []),
    profiles: () => safeFetch(fetchWorkspaceProfiles(workspaceId), []),
    teams: () => safeFetch(fetchWorkspaceTeams(workspaceId), []),
    attendanceRows: () => safeFetch(fetchWorkspaceAttendance(workspaceId), []),
    salaryRows: () => safeFetch(fetchWorkspaceSalaries(workspaceId), []),
    workspaceSettingsBlob: () => safeFetch(fetchWorkspaceSettingsBlob(workspaceId), {}),
    serverMetrics: () => safeFetch(supabase.rpc('get_operational_intelligence', { p_workspace_id: workspaceId }).then(r => r.data), undefined),
  };

  const entries = await Promise.all(keys.map(async key => [key, await loaders[key]()]));
  return Object.fromEntries(entries) as Partial<OperationalSnapshot>;
}
