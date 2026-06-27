export type WorkspaceStatus = 'active' | 'onboarding' | 'inactive' | 'retired';

export class WorkspaceLifecycleEngine {
  /**
   * Only active, onboarding, and sandbox workspaces can accept new tasks.
   */
  static canAcceptTasks(status: WorkspaceStatus | string): boolean {
    const s = (status || '').toLowerCase();
    return s === 'active' || s === 'onboarding' || s === 'sandbox';
  }

  /**
   * Only active, onboarding, and sandbox workspaces can invite users.
   */
  static canInviteUsers(status: WorkspaceStatus | string): boolean {
    const s = (status || '').toLowerCase();
    return s === 'active' || s === 'onboarding' || s === 'sandbox';
  }

  /**
   * Sandbox and retired/inactive workspaces are excluded from company reports/analytics.
   */
  static appearsInReports(status: WorkspaceStatus | string): boolean {
    const s = (status || '').toLowerCase();
    return s === 'active';
  }

  /**
   * Only sandbox workspaces can be fully purged/reset.
   */
  static canBePurged(status: WorkspaceStatus | string): boolean {
    const s = (status || '').toLowerCase();
    return s === 'sandbox';
  }
}
