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

  // Stabilize ui prop functions using a mutable ref pattern to prevent context value churn
  // when ui properties change identity across parent renders.
  const uiRef = React.useRef(ui);
  React.useEffect(() => {
    uiRef.current = ui;
  }, [ui]);

  const setSearchTerm = React.useCallback((term: string) => {
    uiRef.current.setSearchTerm(term);
  }, []);

  const setDashboardTab = React.useCallback((tab: 'dashboard' | 'active' | 'completed' | 'intelligence') => {
    uiRef.current.setDashboardTab(tab);
  }, []);

  const setIsAdding = React.useCallback((adding: boolean) => {
    uiRef.current.setIsAdding(adding);
  }, []);

  const handleUpdateProjectMetadata = React.useCallback((id: string, updates: Partial<import('../../types').Project>) => {
    return uiRef.current.handleUpdateProjectMetadata(id, updates);
  }, []);

  const handlePromoteTaskToAsset = React.useCallback((taskData: { title: string; description: string; projectId: string }) => {
    uiRef.current.handlePromoteTaskToAsset(taskData);
  }, []);

  const askConfirmation = React.useCallback((title: string, message: string, onConfirm: () => void, confirmText?: string) => {
    uiRef.current.askConfirmation(title, message, onConfirm, confirmText);
  }, []);

  const notify = React.useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    uiRef.current.notify(message, type);
  }, []);

  const setIsRosterOpen = React.useCallback((open: boolean) => {
    uiRef.current.setIsRosterOpen?.(open);
  }, []);

  const setSelectedProject = React.useCallback((project: import('../../types').Project | null) => {
    uiRef.current.setSelectedProject?.(project);
  }, []);

  const createSprint = React.useCallback((sprint: Omit<import('../../types').Sprint, 'id' | 'created_at' | 'updated_at'>) => {
    return uiRef.current.createSprint?.(sprint);
  }, []);

  const createMeeting = React.useCallback((meeting: Omit<import('../../types').Meeting, 'id' | 'created_at' | 'updated_at'>) => {
    return uiRef.current.createMeeting?.(meeting);
  }, []);

  const updateExecutionMode = React.useCallback((projectId: string, mode: import('../../types').ExecutionMode) => {
    return uiRef.current.updateExecutionMode?.(projectId, mode);
  }, []);

  const handleSaveLogistics = React.useCallback(async (data: any) => {
    const result = await handleSaveLogisticsData(data);
    if (result === 'unauthorized') {
      notify('Unauthorized: Insufficient permissions to modify logistics.', 'error');
    }
  }, [handleSaveLogisticsData, notify]);

  // Destructure taskActions functions to specify precise dependencies rather than the entire object container.
  const { addDependency, removeDependency, updateTaskDates, updateTask } = taskActions;

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
    setSearchTerm,
    dashboardTab: ui.dashboardTab,
    setDashboardTab,
    isAdding: ui.isAdding,
    setIsAdding,
    handleCreateTeam,
    handleUpdateTeam,
    handleDeleteTeam,
    handleUpdateRole,
    handleSaveLogisticsData: handleSaveLogistics,
    handleUpdateProjectMetadata,
    handlePromoteTaskToAsset,
    askConfirmation,
    notify,
    fetchProjects: refreshProjects,
    invalidateAll: refreshAll,
    addDependency,
    removeDependency,
    updateTaskDates,
    updateTask,
    notifications: dbNotifications as any,
    markAsRead: markNotificationRead,
    workingHoursPerDay: ui.workingHoursPerDay,
    tilesPerRow: ui.tilesPerRow,
    setIsRosterOpen,
    setSelectedProject,
    createSprint,
    createMeeting,
    updateExecutionMode,
    updateWorkspaceSettings,
    projectFrictionMetrics: derived.projectFrictionMetrics,
    timelineShiftLedger: derived.timelineShiftLedger,
    workspaceSettingsBlob: raw.workspaceSettingsBlob,
  }), [
    derived.projectsWithPert,
    derived.visibleTasks,
    derived.userCustomRoles,
    derived.customRoles,
    derived.systemData,
    derived.stats,
    derived.projectFrictionMetrics,
    derived.timelineShiftLedger,
    raw.dependencies,
    raw.profiles,
    raw.teams,
    raw.workspaceSettingsBlob,
    ui.searchTerm,
    ui.dashboardTab,
    ui.isAdding,
    ui.workingHoursPerDay,
    ui.tilesPerRow,
    setSearchTerm,
    setDashboardTab,
    setIsAdding,
    handleCreateTeam,
    handleUpdateTeam,
    handleDeleteTeam,
    handleUpdateRole,
    handleSaveLogistics,
    handleUpdateProjectMetadata,
    handlePromoteTaskToAsset,
    askConfirmation,
    notify,
    refreshProjects,
    refreshAll,
    addDependency,
    removeDependency,
    updateTaskDates,
    updateTask,
    dbNotifications,
    markNotificationRead,
    setIsRosterOpen,
    setSelectedProject,
    createSprint,
    createMeeting,
    updateExecutionMode,
    updateWorkspaceSettings,
  ]);

  return (
    <DashboardProvider value={providerValue}>
      {children}
    </DashboardProvider>
  );
}
