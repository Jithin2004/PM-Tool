import React, { createContext, useContext } from 'react';
import { Project, Team, Task, TaskDependency, Sprint, Epic, Milestone, Approval, Meeting, ExecutionMode } from '../types';

interface DashboardContextType {
  projects: Project[];
  tasks: Task[];
  dependencies: TaskDependency[];
  profiles: any[];
  teams: Team[];
  sprints: Sprint[];
  epics: Epic[];
  milestones: Milestone[];
  approvals: Approval[];
  meetings: Meeting[];
  userCustomRoles: Record<string, string>;
  customRoles: string[];
  systemData: any;
  stats: any;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  dashboardTab: 'active' | 'completed' | 'intelligence';
  setDashboardTab: (tab: 'active' | 'completed' | 'intelligence') => void;
  isAdding: boolean;
  setIsAdding: (adding: boolean) => void;
  
  handleCreateTeam: (name: string, pmId: string, devIds: string[]) => Promise<void>;
  handleUpdateTeam: (id: string, name: string, pmId: string, devIds: string[]) => Promise<void>;
  handleDeleteTeam: (id: string) => Promise<void>;
  handleUpdateRole: (id: string, role: any) => Promise<void>;
  handleSaveLogisticsData: (data: any) => Promise<void>;
  handleUpdateProjectMetadata: (id: string, updates: Partial<Project>) => Promise<void>;
  handlePromoteTaskToAsset: (taskData: any) => void;
  askConfirmation: (title: string, message: string, onConfirm: () => void, confirmText?: string) => void;
  notify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  fetchProjects: () => Promise<void>;
  invalidateAll: () => Promise<void>;
  addDependency: (taskId: string, dependsOnTaskId: string) => Promise<void>;
  removeDependency: (taskId: string, dependsOnTaskId: string) => Promise<void>;
  updateTaskDates: (taskId: string, startDate: string | null, deadline: string | null) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  notifications: Notification[];
  markAsRead: (notificationId: string) => Promise<void>;
  workingHoursPerDay?: number;
  tilesPerRow?: number;
  setIsRosterOpen?: (open: boolean) => void;
  setSelectedProject?: (project: Project | null) => void;
  createSprint?: (sprint: Omit<Sprint, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  createMeeting?: (meeting: Omit<Meeting, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateExecutionMode?: (projectId: string, mode: ExecutionMode) => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export const DashboardProvider = DashboardContext.Provider;

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};
