export type LogicalStateCategory = 
  | 'backlog' 
  | 'not_started' 
  | 'active' 
  | 'review' 
  | 'blocked' 
  | 'completed' 
  | 'cancelled';

export interface LogicalStatus {
  category: LogicalStateCategory;
  isActive: boolean;
  isCompleted: boolean;
  isBlocked: boolean;
}

export const statusResolver = {
  getLogicalStatus(task: any): LogicalStatus {
    let category: LogicalStateCategory = 'not_started';

    if (task.workflow_state?.state_category) {
      category = task.workflow_state.state_category as LogicalStateCategory;
    } else if (task.status) {
      // Legacy fallback
      switch (task.status) {
        case 'backlog':
          category = 'backlog';
          break;
        case 'ready':
        case 'ready_for_review':
        case 'assigned':
          category = 'not_started';
          break;
        case 'in_progress':
          category = 'active';
          break;
        case 'review':
        case 'changes_requested':
          category = 'review';
          break;
        case 'blocked':
          category = 'blocked';
          break;
        case 'done':
        case 'completed':
          category = 'completed';
          break;
        case 'cancelled':
          category = 'cancelled';
          break;
        default:
          category = 'not_started';
      }
    }

    return {
      category,
      isActive: category === 'active' || category === 'review',
      isCompleted: category === 'completed' || category === 'cancelled',
      isBlocked: category === 'blocked',
    };
  }
};
