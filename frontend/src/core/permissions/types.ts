import type { UserRole, Task, TaskDependency, ExecutionBlocker } from '../../types';

export type ExecutionOwnershipType =
  | 'ProjectOwner'
  | 'ExecutionLead'
  | 'TaskAssignee'
  | 'BlockerOwner'
  | 'DependencyOwner'
  | 'Reviewer'
  | 'Stakeholder'
  | 'Watcher';

export interface PermissionContext {
  userId: string;
  role: UserRole;
  ownerProjectIds: Set<string>;
  assignedTeamProjectIds: Set<string>;
  // Enterprise execution context for Phase 3 scope resolution
  tasks?: Task[];
  dependencies?: TaskDependency[];
  blockers?: ExecutionBlocker[];
  workspaceSettingsBlob?: Record<string, any>;
}

export interface EntityVisibility {
  visible: boolean;
  reason: 'direct' | 'inherited' | 'role' | 'denied';
  inheritedFrom?: string;
}

export type PermissionAction =
  | 'view'
  | 'edit'
  | 'delete'
  | 'create'
  | 'manage'
  | 'admin';

export type EntityType =
  | 'task'
  | 'project'
  | 'epic'
  | 'sprint'
  | 'story'
  | 'comment'
  | 'file'
  | 'activity'
  | 'milestone'
  | 'meeting'
  | 'approval';

export interface InheritedContext {
  userId: string;
  role: UserRole;
  ownerProjectIds: Set<string>;
  visibleTaskIds: Set<string>;
  visibleProjectIds: Set<string>;
  visibleEpicIds: Set<string>;
  visibleSprintIds: Set<string>;
}

export function buildPermissionContext(
  userId: string,
  role: UserRole,
  ownerProjectIds: string[],
  assignedTeamProjectIds: string[] = [],
  tasks?: Task[],
  dependencies?: TaskDependency[],
  blockers?: ExecutionBlocker[],
  workspaceSettingsBlob?: Record<string, any>,
): PermissionContext {
  return {
    userId,
    role,
    ownerProjectIds: new Set(ownerProjectIds),
    assignedTeamProjectIds: new Set(assignedTeamProjectIds),
    tasks,
    dependencies,
    blockers,
    workspaceSettingsBlob,
  };
}
