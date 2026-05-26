import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';
import { useTasks } from '../hooks/useTasks';
import { hasCapability } from '../core/auth/permissions';
import { computeOperationalDerived } from '../core/operational/derivedMetrics';
import type { OperationalDerivedState, OperationalRawState } from '../core/operational/types';
import { refreshOperationalSnapshot, refreshOperationalPartial } from '../services/operationalSyncService';
import { saveLogisticsData } from '../services/logisticsService';
import {
  loadWorkspaceNotifications,
  subscribeToWorkspaceNotifications,
} from '../services/realtimeNotificationService';
import type { Project, Profile, Team, UserRole } from '../types';

interface OperationalDataContextValue {
  raw: OperationalRawState;
  derived: OperationalDerivedState;
  loading: boolean;
  dbNotifications: Record<string, unknown>[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  refreshAll: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  handleSaveLogisticsData: (data: Record<string, unknown>) => Promise<'success' | 'unauthorized' | 'error'>;
  handleCreateTeam: (name: string, pmId: string, devIds: string[]) => Promise<void>;
  handleUpdateTeam: (id: string, name: string, pmId: string, devIds: string[]) => Promise<void>;
  handleDeleteTeam: (id: string) => Promise<void>;
  handleUpdateRole: (id: string, role: UserRole) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  fetchNotifications: () => Promise<void>;
  taskActions: {
    addDependency: ReturnType<typeof useTasks>['addDependency'];
    removeDependency: ReturnType<typeof useTasks>['removeDependency'];
    updateTaskDates: ReturnType<typeof useTasks>['updateTaskDates'];
    updateTask: ReturnType<typeof useTasks>['updateTask'];
  };
}

const OperationalDataContext = createContext<OperationalDataContextValue | null>(null);

export function OperationalDataProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, updateRole } = useAuth();
  const { workspace } = useWorkspace();
  const {
    tasks,
    dependencies,
    addDependency,
    removeDependency,
    updateTaskDates,
    updateTask,
  } = useTasks(workspace?.id);

  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<OperationalRawState['attendanceRows']>([]);
  const [salaryRows, setSalaryRows] = useState<OperationalRawState['salaryRows']>([]);
  const [workspaceSettingsBlob, setWorkspaceSettingsBlob] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [dbNotifications, setDbNotifications] = useState<Record<string, unknown>[]>([]);

  const raw: OperationalRawState = useMemo(
    () => ({
      projects,
      tasks,
      dependencies,
      teams,
      profiles,
      attendanceRows,
      salaryRows,
      workspaceSettingsBlob,
    }),
    [projects, tasks, dependencies, teams, profiles, attendanceRows, salaryRows, workspaceSettingsBlob],
  );

  const derived = useMemo(
    () =>
      computeOperationalDerived({
        projects,
        tasks,
        teams,
        profiles,
        attendanceRows,
        salaryRows,
        workspaceSettingsBlob,
        userId: profile?.id || '',
        userRole: profile?.role || 'viewer',
      }),
    [projects, tasks, teams, profiles, attendanceRows, salaryRows, workspaceSettingsBlob, profile?.id, profile?.role],
  );

  const refreshAll = useCallback(async () => {
    if (!workspace?.id) return;
    const snapshot = await refreshOperationalSnapshot(workspace.id);
    setProjects(snapshot.projects);
    setProfiles(snapshot.profiles);
    setTeams(snapshot.teams);
    setAttendanceRows(snapshot.attendanceRows);
    setSalaryRows(snapshot.salaryRows);
    setWorkspaceSettingsBlob(snapshot.workspaceSettingsBlob);
  }, [workspace?.id]);

  const refreshProjects = useCallback(async () => {
    if (!workspace?.id) return;
    const partial = await refreshOperationalPartial(workspace.id, ['projects']);
    if (partial.projects) setProjects(partial.projects);
  }, [workspace?.id]);

  const fetchNotifications = useCallback(async () => {
    if (!workspace?.id) return;
    const data = await loadWorkspaceNotifications(workspace.id, user?.id);
    setDbNotifications(data);
  }, [workspace?.id, user?.id]);

  const markNotificationRead = useCallback(
    async (notificationId: string) => {
      if (!workspace?.id) return;
      const { markAsRead } = await import('../services/notificationService');
      const success = await markAsRead(notificationId, workspace.id);
      if (success) {
        setDbNotifications(prev =>
          prev.map(n =>
            n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n,
          ),
        );
      }
    },
    [workspace?.id],
  );

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (user && profile && workspace?.id) {
        await refreshAll();
      } else if (!user) {
        setProjects([]);
        setTeams([]);
        setProfiles([]);
        setAttendanceRows([]);
        setSalaryRows([]);
      }
      if (mounted) setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
  }, [user, profile, workspace?.id, refreshAll]);

  useEffect(() => {
    fetchNotifications();
    if (!workspace?.id) return;

    return subscribeToWorkspaceNotifications(workspace.id, user?.id, row => {
      setDbNotifications(prev => [row, ...prev]);
      window.dispatchEvent(
        new CustomEvent('notify-toast', {
          detail: {
            message: `${String(row.title || '').toUpperCase()}: ${row.body || ''}`,
            type: 'warning',
          },
        }),
      );
    });
  }, [workspace?.id, user?.id, fetchNotifications]);

  const handleSaveLogisticsData = useCallback(
    async (updatedData: Record<string, unknown>) => {
      if (!hasCapability(profile?.role, 'manage_logistics') || !workspace?.id) {
        return 'unauthorized';
      }

      const result = await saveLogisticsData({
        workspaceId: workspace.id,
        updatedData,
        previousSystemData: derived.systemData,
      });

      setWorkspaceSettingsBlob(prev => ({ ...prev, ...result.settingsPatch }));
      if (result.attendanceRows) setAttendanceRows(result.attendanceRows);
      if (result.salaryRows) setSalaryRows(result.salaryRows);
      if (result.teamsPatch) setTeams(result.teamsPatch);

      if (result.persisted) {
        window.dispatchEvent(
          new CustomEvent('notify-toast', {
            detail: { message: 'Logistics analytics synchronized.', type: 'success' },
          }),
        );
      }

      return result.persisted ? 'success' : 'error';
    },
    [profile?.role, workspace?.id, derived.systemData],
  );

  const handleCreateTeam = useCallback(
    async (name: string, pmId: string, devIds: string[]) => {
      if (!hasCapability(profile?.role, 'manage_teams') || !workspace?.id) return;

      const { data, error } = await supabase
        .from('teams')
        .insert({ workspace_id: workspace.id, name, capacity_hours_per_week: 40 * devIds.length })
        .select()
        .single();

      if (!error && data) {
        const memberInserts: Record<string, unknown>[] = [];
        if (pmId) {
          memberInserts.push({
            workspace_id: workspace.id,
            team_id: data.id,
            user_id: pmId,
            member_role: 'pm',
          });
        }
        devIds.forEach(devId => {
          memberInserts.push({
            workspace_id: workspace.id,
            team_id: data.id,
            user_id: devId,
            member_role: 'developer',
          });
        });
        if (memberInserts.length > 0) {
          await supabase.from('team_members').insert(memberInserts);
        }
        setTeams(prev => [
          ...prev,
          { ...data, data: { pm_id: pmId, developer_ids: devIds } } as Team,
        ]);
      }
    },
    [profile?.role, workspace?.id],
  );

  const handleUpdateTeam = useCallback(
    async (id: string, name: string, pmId: string, devIds: string[]) => {
      if (!hasCapability(profile?.role, 'manage_teams') || !workspace?.id) return;

      await supabase.from('teams').update({ name }).eq('id', id);
      await supabase.from('team_members').delete().eq('team_id', id);

      const memberInserts: Record<string, unknown>[] = [];
      if (pmId) {
        memberInserts.push({
          workspace_id: workspace.id,
          team_id: id,
          user_id: pmId,
          member_role: 'pm',
        });
      }
      devIds.forEach(devId => {
        memberInserts.push({
          workspace_id: workspace.id,
          team_id: id,
          user_id: devId,
          member_role: 'developer',
        });
      });
      if (memberInserts.length > 0) {
        await supabase.from('team_members').insert(memberInserts);
      }

      setTeams(prev =>
        prev.map(t =>
          t.id === id ? { ...t, name, data: { pm_id: pmId, developer_ids: devIds } } : t,
        ),
      );
    },
    [profile?.role, workspace?.id],
  );

  const handleDeleteTeam = useCallback(
    async (id: string) => {
      if (!hasCapability(profile?.role, 'manage_teams')) return;
      await supabase.from('team_members').delete().eq('team_id', id);
      await supabase.from('teams').delete().eq('id', id);
      setTeams(prev => prev.filter(t => t.id !== id));
    },
    [profile?.role],
  );

  const handleUpdateRoleLocal = useCallback(
    async (id: string, role: UserRole) => {
      await updateRole(id, role);
      setProfiles(prev => prev.map(p => (p.id === id ? { ...p, role } : p)));
    },
    [updateRole],
  );

  const value = useMemo<OperationalDataContextValue>(
    () => ({
      raw,
      derived,
      loading,
      dbNotifications,
      setProjects,
      refreshAll,
      refreshProjects,
      handleSaveLogisticsData,
      handleCreateTeam,
      handleUpdateTeam,
      handleDeleteTeam,
      handleUpdateRole: handleUpdateRoleLocal,
      markNotificationRead,
      fetchNotifications,
      taskActions: { addDependency, removeDependency, updateTaskDates, updateTask },
    }),
    [
      raw,
      derived,
      loading,
      dbNotifications,
      refreshAll,
      refreshProjects,
      handleSaveLogisticsData,
      handleCreateTeam,
      handleUpdateTeam,
      handleDeleteTeam,
      handleUpdateRoleLocal,
      markNotificationRead,
      fetchNotifications,
      addDependency,
      removeDependency,
      updateTaskDates,
      updateTask,
    ],
  );

  return (
    <OperationalDataContext.Provider value={value}>{children}</OperationalDataContext.Provider>
  );
}

export function useOperationalData() {
  const ctx = useContext(OperationalDataContext);
  if (!ctx) {
    throw new Error('useOperationalData must be used within OperationalDataProvider');
  }
  return ctx;
}

export function useOperationalRaw() {
  return useOperationalData().raw;
}

export function useOperationalDerived() {
  return useOperationalData().derived;
}
