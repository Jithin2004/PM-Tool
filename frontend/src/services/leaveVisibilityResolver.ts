import { hasCapability } from '../core/auth/permissions';

export const leaveVisibilityResolver = {
  /**
   * Resolves exactly what details a viewer can see about a leave record based on privacy rules.
   */
  resolveVisibility(leaveRecord: any, viewerId: string, viewerRole: string, viewerIsManager: boolean) {
    // Admin / HR -> Full details
    if (hasCapability(viewerRole as any, 'people.manage')) {
      return {
        ...leaveRecord,
        visibility: 'full'
      };
    }

    // Self -> Full details
    if (viewerId === leaveRecord.user_id) {
      return {
        ...leaveRecord,
        visibility: 'full'
      };
    }

    // Manager -> Reason visible
    if (viewerIsManager || viewerId === leaveRecord.manager_id) {
      return {
        ...leaveRecord,
        visibility: 'manager'
      };
    }

    // Peer -> Availability only (redact reason and exact type details if necessary)
    return {
      user_id: leaveRecord.user_id,
      start_date: leaveRecord.start_date,
      end_date: leaveRecord.end_date,
      status: leaveRecord.status,
      leave_type: 'Unavailable',
      reason: 'Redacted for privacy',
      visibility: 'peer'
    };
  }
};
