import React from 'react';
import { DashboardProvider } from '../../context/DashboardContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { useAuth } from '../../context/AuthContext';

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

  const { isSimulating } = useAuth();

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
    if (isSimulating) { notify('Read-Only Simulation Mode. Action blocked.', 'warning'); return Promise.resolve(); }
    return uiRef.current.handleUpdateProjectMetadata(id, updates);
  }, [isSimulating]);

  const handlePromoteTaskToAsset = React.useCallback((taskData: { title: string; description: string; projectId: string }) => {
    if (isSimulating) { notify('Read-Only Simulation Mode. Action blocked.', 'warning'); return; }
    uiRef.current.handlePromoteTaskToAsset(taskData);
  }, [isSimulating]);

  const askConfirmation = React.useCallback((title: string, message: string, onConfirm: () => void, confirmText?: string) => {
    if (isSimulating) { notify('Read-Only Simulation Mode. Action blocked.', 'warning'); return; }
    uiRef.current.askConfirmation(title, message, onConfirm, confirmText);
  }, [isSimulating]);

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
    if (isSimulating) { notify('Read-Only Simulation Mode. Action blocked.', 'warning'); return Promise.resolve(); }
    return uiRef.current.createSprint?.(sprint) || Promise.resolve();
  }, [isSimulating]);

  const createMeeting = React.useCallback((meeting: Omit<import('../../types').Meeting, 'id' | 'created_at' | 'updated_at'>) => {
    if (isSimulating) { notify('Read-Only Simulation Mode. Action blocked.', 'warning'); return Promise.resolve(); }
    return uiRef.current.createMeeting?.(meeting) || Promise.resolve();
  }, [isSimulating]);

  const updateExecutionMode = React.useCallback((projectId: string, mode: import('../../types').ExecutionMode) => {
    if (isSimulating) { notify('Read-Only Simulation Mode. Action blocked.', 'warning'); return Promise.resolve(); }
    return uiRef.current.updateExecutionMode?.(projectId, mode) || Promise.resolve();
  }, [isSimulating]);

  const handleSaveLogistics = React.useCallback(async (data: any) => {
    if (isSimulating) { notify('Read-Only Simulation Mode. Action blocked.', 'warning'); return; }
    const result = await handleSaveLogisticsData(data);
    if (result === 'unauthorized') {
      notify('Unauthorized: Insufficient permissions to modify logistics.', 'error');
    }
  }, [handleSaveLogisticsData, notify, isSimulating]);

  // Destructure taskActions functions to specify precise dependencies rather than the entire object container.
  const { addDependency: origAddDependency, removeDependency: origRemoveDependency, updateTaskDates: origUpdateTaskDates, updateTask: origUpdateTask } = taskActions;

  const addDependency = React.useCallback(async (...args: Parameters<typeof origAddDependency>) => {
    if (isSimulating) { notify('Read-Only Simulation Mode. Action blocked.', 'warning'); return; }
    return origAddDependency(...args);
  }, [origAddDependency, isSimulating, notify]);

  const removeDependency = React.useCallback(async (...args: Parameters<typeof origRemoveDependency>) => {
    if (isSimulating) { notify('Read-Only Simulation Mode. Action blocked.', 'warning'); return; }
    return origRemoveDependency(...args);
  }, [origRemoveDependency, isSimulating, notify]);

  const updateTaskDates = React.useCallback(async (...args: Parameters<typeof origUpdateTaskDates>) => {
    if (isSimulating) { notify('Read-Only Simulation Mode. Action blocked.', 'warning'); return; }
    return origUpdateTaskDates(...args);
  }, [origUpdateTaskDates, isSimulating, notify]);

  const updateTask = React.useCallback(async (...args: Parameters<typeof origUpdateTask>) => {
    if (isSimulating) { notify('Read-Only Simulation Mode. Action blocked.', 'warning'); return; }
    return origUpdateTask(...args);
  }, [origUpdateTask, isSimulating, notify]);

  const safeHandleCreateTeam = React.useCallback(async (...args: Parameters<typeof handleCreateTeam>) => {
    if (isSimulating) { notify('Read-Only Simulation Mode. Action blocked.', 'warning'); return; }
    return handleCreateTeam(...args);
  }, [handleCreateTeam, isSimulating, notify]);

  const safeHandleUpdateTeam = React.useCallback(async (...args: Parameters<typeof handleUpdateTeam>) => {
    if (isSimulating) { notify('Read-Only Simulation Mode. Action blocked.', 'warning'); return; }
    return handleUpdateTeam(...args);
  }, [handleUpdateTeam, isSimulating, notify]);

  const safeHandleDeleteTeam = React.useCallback(async (...args: Parameters<typeof handleDeleteTeam>) => {
    if (isSimulating) { notify('Read-Only Simulation Mode. Action blocked.', 'warning'); return; }
    return handleDeleteTeam(...args);
  }, [handleDeleteTeam, isSimulating, notify]);

  const safeHandleUpdateRole = React.useCallback(async (...args: Parameters<typeof handleUpdateRole>) => {
    if (isSimulating) { notify('Read-Only Simulation Mode. Action blocked.', 'warning'); return; }
    return handleUpdateRole(...args);
  }, [handleUpdateRole, isSimulating, notify]);

  const providerValue = React.useMemo(() => ({
    projects: derived.visibleProjects,
    tasks: derived.visibleTasks,
    dependencies: raw.dependencies,
    profiles: raw.profiles,
    teams: raw.teams,
    sprints: [],
    epics: [],
    milestones: [],
    approvals: [],
    meetings: [],
    allocationPeriods: raw.allocationPeriods || [],
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
    handleCreateTeam: safeHandleCreateTeam,
    handleUpdateTeam: safeHandleUpdateTeam,
    handleDeleteTeam: safeHandleDeleteTeam,
    handleUpdateRole: safeHandleUpdateRole,
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
    raw.allocationPeriods,
    ui.searchTerm,
    ui.dashboardTab,
    ui.isAdding,
    ui.workingHoursPerDay,
    ui.tilesPerRow,
    setSearchTerm,
    setDashboardTab,
    setIsAdding,
    safeHandleCreateTeam,
    safeHandleUpdateTeam,
    safeHandleDeleteTeam,
    safeHandleUpdateRole,
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
