import type { UserRole } from '../../types';

export interface PermissionContext {
  userId: string;
  role: UserRole;
  ownerProjectIds: Set<string>;
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
): PermissionContext {
  return {
    userId,
    role,
    ownerProjectIds: new Set(ownerProjectIds),
  };
}
