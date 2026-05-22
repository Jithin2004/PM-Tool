import type { Workspace } from '../types/workspace';

export function isWorkspaceOwner(profileId: string | undefined, workspace: Workspace | null): boolean {
  if (!profileId || !workspace) return false;
  if (profileId !== workspace.ownerId) {
    console.warn(`[isWorkspaceOwner] Identity mismatch: profile.id="${profileId}" !== workspace.ownerId="${workspace.ownerId}". Check auth source.`);
    return false;
  }
  return true;
}

export function requireWorkspaceOwner(profileId: string | undefined, workspace: Workspace | null, operation: string): void {
  if (!isWorkspaceOwner(profileId, workspace)) {
    console.warn(`[requireWorkspaceOwner] Blocked "${operation}": caller is not workspace owner. profile.id="${profileId}", workspace.ownerId="${workspace?.ownerId}"`);
  }
}
