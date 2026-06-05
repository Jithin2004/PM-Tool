import type { Workspace } from '../types/workspace';

export function isWorkspaceOwner(profileId: string | undefined, workspace: Workspace | null): boolean {
  if (!profileId || !workspace) return false;
  if (profileId !== workspace.ownerId) {
    return false;
  }
  return true;
}

export function requireWorkspaceOwner(profileId: string | undefined, workspace: Workspace | null, operation: string): void {
  if (!isWorkspaceOwner(profileId, workspace)) {
  }
}
