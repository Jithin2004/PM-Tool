import { supabase } from '../lib/supabase';
import {
  fetchProjects,
  fetchWorkspaceProfiles,
  fetchWorkspaceTeams,
  fetchWorkspaceAttendance,
  fetchWorkspaceSettingsBlob,
  fetchSkills,
  fetchUserSkills,
} from './operationalDataService';
import type { Project, Profile, Team, Task } from '../types';
import type { AttendanceRow, Skill, UserSkill } from '../core/operational/types';
import { computeOperationalIntelligence } from '../core/system/operationalIntelligenceEngine';

export interface OperationalSnapshot {
  projects: Project[];
  profiles: Profile[];
  teams: Team[];
  attendanceRows: AttendanceRow[];
  workspaceSettingsBlob: Record<string, unknown>;
  serverMetrics?: {
    deliveryConfidence: number;
    executionPressure: number;
    dailyFatigue: number;
    riskForecast: number;
  };
  allocationPeriods: any[]; // Phase 2A.1
  skills?: Skill[];
  userSkills?: UserSkill[];
}

async function fetchTasks(workspaceId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('workspace_id', workspaceId);
  if (error) {
    console.error('[operationalSyncService] fetchTasks:', error);
    return [];
  }
  return (data || []) as Task[];
}

export async function refreshOperationalSnapshot(workspaceId: string): Promise<OperationalSnapshot> {
  const safeFetch = async <T>(promise: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await promise;
    } catch (err) {
      return fallback;
    }
  };

  const [projects, profiles, teams, attendanceRows, workspaceSettingsBlob, tasks, allocationPeriods, skills, userSkills] = await Promise.all([
    safeFetch(fetchProjects(workspaceId), []),
    safeFetch(fetchWorkspaceProfiles(workspaceId), []),
    safeFetch(fetchWorkspaceTeams(workspaceId), []),
    safeFetch(fetchWorkspaceAttendance(workspaceId), []),
    safeFetch(fetchWorkspaceSettingsBlob(workspaceId), {}),
    safeFetch(fetchTasks(workspaceId), []),
    safeFetch(import('./capacityEngine').then(m => m.capacityEngine.fetchAllocationPeriods(workspaceId)), []),
    safeFetch(fetchSkills(workspaceId), []),
    safeFetch(fetchUserSkills(workspaceId), [])
  ]);

  const serverMetrics = computeOperationalIntelligence(projects, tasks);

  return { 
    projects, 
    profiles, 
    teams,
    attendanceRows,
    workspaceSettingsBlob,
    serverMetrics,
    allocationPeriods,
    skills,
    userSkills
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
      return fallback;
    }
  };

  const loaders: Record<keyof OperationalSnapshot, () => Promise<unknown>> = {
    projects: () => safeFetch(fetchProjects(workspaceId), []),
    profiles: () => safeFetch(fetchWorkspaceProfiles(workspaceId), []),
    teams: () => safeFetch(fetchWorkspaceTeams(workspaceId), []),
    attendanceRows: () => safeFetch(fetchWorkspaceAttendance(workspaceId), []),
    workspaceSettingsBlob: () => safeFetch(fetchWorkspaceSettingsBlob(workspaceId), {}),
    serverMetrics: async () => {
      const proj = await safeFetch(fetchProjects(workspaceId), []);
      const tsk = await safeFetch(fetchTasks(workspaceId), []);
      return computeOperationalIntelligence(proj, tsk);
    },
    allocationPeriods: () => safeFetch(import('./capacityEngine').then(m => m.capacityEngine.fetchAllocationPeriods(workspaceId)), []),
    skills: () => safeFetch(fetchSkills(workspaceId), []),
    userSkills: () => safeFetch(fetchUserSkills(workspaceId), [])
  };

  const entries = await Promise.all(keys.map(async key => [key, await loaders[key]()]));
  return Object.fromEntries(entries) as Partial<OperationalSnapshot>;
}
