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
}

export async function refreshOperationalSnapshot(workspaceId: string): Promise<OperationalSnapshot> {
  const [projects, profiles, teams, attendanceRows, salaryRows, workspaceSettingsBlob] = await Promise.all([
    fetchProjects(workspaceId),
    fetchWorkspaceProfiles(workspaceId),
    fetchWorkspaceTeams(workspaceId),
    fetchWorkspaceAttendance(workspaceId),
    fetchWorkspaceSalaries(workspaceId),
    fetchWorkspaceSettingsBlob(workspaceId),
  ]);

  return { projects, profiles, teams, attendanceRows, salaryRows, workspaceSettingsBlob };
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
  };

  const entries = await Promise.all(keys.map(async key => [key, await loaders[key]()]));
  return Object.fromEntries(entries) as Partial<OperationalSnapshot>;
}
