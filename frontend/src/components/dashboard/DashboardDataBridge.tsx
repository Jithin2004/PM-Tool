import React from 'react';
import { DashboardProvider } from '../../context/DashboardContext';
import { useOperationalData } from '../../context/OperationalDataContext';

interface DashboardDataBridgeProps {
  children: React.ReactNode;
  ui: {
    searchTerm: string;
    setSearchTerm: (v: string) => void;
    dashboardTab: 'dashboard' | 'active' | 'completed' | 'intelligence';
    setDashboardTab: (v: 'dashboard' | 'active' | 'completed' | 'intelligence') => void;
    isAdding: boolean;
    setIsAdding: (v: boolean) => void;
    handleUpdateProjectMetadata: (id: string, updates: Partial<import('../../types').Project>) => Promise<void>;
    handlePromoteTaskToAsset: (taskData: { title: string; description: string; projectId: string }) => void;
    askConfirmation: (
      title: string,
      message: string,
      onConfirm: () => void,
      confirmText?: string,
    ) => void;
    notify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    workingHoursPerDay?: number;
    tilesPerRow?: number;
    setIsRosterOpen?: (open: boolean) => void;
    setSelectedProject?: (project: import('../../types').Project | null) => void;
    updateExecutionMode?: (projectId: string, mode: import('../../types').ExecutionMode) => Promise<void>;
    createSprint?: (sprint: Omit<import('../../types').Sprint, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
    createMeeting?: (meeting: Omit<import('../../types').Meeting, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  };
}

export function DashboardDataBridge({ children, ui }: DashboardDataBridgeProps) {
  const {
    raw,
    derived,
    dbNotifications,
    refreshAll,
    refreshProjects,
    handleSaveLogisticsData,
    handleCreateTeam,
    handleUpdateTeam,
    handleDeleteTeam,
    handleUpdateRole,
    markNotificationRead,
    taskActions,
    updateWorkspaceSettings,
  } = useOperationalData();

  const handleSaveLogistics = React.useCallback(async (data: any) => {
    const result = await handleSaveLogisticsData(data);
    if (result === 'unauthorized') {
      ui.notify('Unauthorized: Insufficient permissions to modify logistics.', 'error');
    }
  }, [handleSaveLogisticsData, ui]);

  const providerValue = React.useMemo(() => ({
    projects: derived.projectsWithPert,
    tasks: derived.visibleTasks,
    dependencies: raw.dependencies,
    profiles: raw.profiles,
    teams: raw.teams,
    sprints: [],
    epics: [],
    milestones: [],
    approvals: [],
    meetings: [],
    userCustomRoles: derived.userCustomRoles,
    customRoles: derived.customRoles,
    systemData: derived.systemData,
    stats: derived.stats,
    searchTerm: ui.searchTerm,
    setSearchTerm: ui.setSearchTerm,
    dashboardTab: ui.dashboardTab,
    setDashboardTab: ui.setDashboardTab,
    isAdding: ui.isAdding,
    setIsAdding: ui.setIsAdding,
    handleCreateTeam,
    handleUpdateTeam,
    handleDeleteTeam,
    handleUpdateRole,
    handleSaveLogisticsData: handleSaveLogistics,
    handleUpdateProjectMetadata: ui.handleUpdateProjectMetadata,
    handlePromoteTaskToAsset: ui.handlePromoteTaskToAsset,
    askConfirmation: ui.askConfirmation,
    notify: ui.notify,
    fetchProjects: refreshProjects,
    invalidateAll: refreshAll,
    addDependency: taskActions.addDependency,
    removeDependency: taskActions.removeDependency,
    updateTaskDates: taskActions.updateTaskDates,
    updateTask: taskActions.updateTask,
    notifications: dbNotifications as any,
    markAsRead: markNotificationRead,
    workingHoursPerDay: ui.workingHoursPerDay,
    tilesPerRow: ui.tilesPerRow,
    setIsRosterOpen: ui.setIsRosterOpen,
    setSelectedProject: ui.setSelectedProject,
    createSprint: ui.createSprint,
    createMeeting: ui.createMeeting,
    updateExecutionMode: ui.updateExecutionMode,
    updateWorkspaceSettings,
    projectFrictionMetrics: derived.projectFrictionMetrics,
    timelineShiftLedger: derived.timelineShiftLedger,
    workspaceSettingsBlob: raw.workspaceSettingsBlob,
  }), [
    derived.projectsWithPert, derived.visibleTasks, derived.userCustomRoles, derived.customRoles, derived.systemData, derived.stats,
    derived.projectFrictionMetrics, derived.timelineShiftLedger,
    raw.dependencies, raw.profiles, raw.teams, raw.workspaceSettingsBlob,
    ui.searchTerm, ui.setSearchTerm, ui.dashboardTab, ui.setDashboardTab, ui.isAdding, ui.setIsAdding, ui.handleUpdateProjectMetadata, ui.handlePromoteTaskToAsset, ui.askConfirmation, ui.notify, ui.workingHoursPerDay, ui.tilesPerRow, ui.setIsRosterOpen, ui.setSelectedProject, ui.createSprint, ui.createMeeting, ui.updateExecutionMode,
    handleCreateTeam, handleUpdateTeam, handleDeleteTeam, handleUpdateRole, handleSaveLogistics,
    refreshProjects, refreshAll, taskActions, dbNotifications, markNotificationRead, updateWorkspaceSettings
  ]);

  return (
    <DashboardProvider value={providerValue}>
      {children}
    </DashboardProvider>
  );
}
