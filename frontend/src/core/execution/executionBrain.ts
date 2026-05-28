import type { 
  ExecutionCategory, 
  ExecutionState, 
  ExecutionDependency, 
  ExecutionStream, 
  Task 
} from '../types';

/**
 * Returns the parent category for any canonical execution state.
 */
export function getExecutionCategory(state: ExecutionState): ExecutionCategory {
  switch (state) {
    case 'EXECUTING':
    case 'DEPLOYING':
    case 'TESTING':
    case 'VALIDATING':
      return 'ACTIVE';

    case 'WAITING_FOR_CLIENT':
    case 'WAITING_FOR_DATA':
    case 'WAITING_FOR_INFRASTRUCTURE':
    case 'WAITING_FOR_APPROVAL':
      return 'WAITING';

    case 'BLOCKED_DEPENDENCY':
    case 'BLOCKED_INFRASTRUCTURE':
    case 'BLOCKED_ACCESS':
      return 'BLOCKED';

    case 'CLIENT_VERIFICATION':
    case 'RELEASE_WINDOW_PENDING':
    case 'INTERNAL_REVIEW':
      return 'COORDINATION';

    default:
      return 'ACTIVE';
  }
}

/**
 * Maps granular execution states to Vite's V3 legacy DB/UI Task statuses
 * to ensure complete backward compatibility.
 */
export function mapToTaskStatus(state: ExecutionState): 'backlog' | 'ready' | 'in_progress' | 'review' | 'done' {
  switch (state) {
    // ACTIVE Mapping
    case 'EXECUTING':
    case 'DEPLOYING':
      return 'in_progress';
    case 'TESTING':
    case 'VALIDATING':
      return 'review';

    // WAITING / BLOCKED Mapping (Vite models these as 'blocked' or triage states; we map to backlog or in_progress fallback)
    case 'WAITING_FOR_CLIENT':
    case 'WAITING_FOR_DATA':
    case 'WAITING_FOR_INFRASTRUCTURE':
    case 'WAITING_FOR_APPROVAL':
    case 'BLOCKED_DEPENDENCY':
    case 'BLOCKED_INFRASTRUCTURE':
    case 'BLOCKED_ACCESS':
      return 'ready'; // ready to execute once blockers clear

    // COORDINATION Mapping
    case 'INTERNAL_REVIEW':
    case 'CLIENT_VERIFICATION':
      return 'review';
    case 'RELEASE_WINDOW_PENDING':
      return 'ready';

    default:
      return 'in_progress';
  }
}

/**
 * Enforces rigid state transition bounds across execution phases.
 * Specifically checks for dependency gates.
 */
export function canTransitionTo(
  currentState: ExecutionState,
  targetState: ExecutionState,
  dependencies: ExecutionDependency[]
): { allowed: boolean; reason?: string } {
  // If target is ACTIVE and task is blocked by active dependencies, deny transition
  const activeBlockers = dependencies.filter(d => d.status === 'active');
  
  if ((targetState === 'EXECUTING' || targetState === 'DEPLOYING') && activeBlockers.length > 0) {
    return { 
      allowed: false, 
      reason: `Blocked by ${activeBlockers.length} active upstream dependencies.` 
    };
  }

  // Blocker state mapping logic
  if (targetState === 'BLOCKED_DEPENDENCY' && activeBlockers.length === 0) {
    return {
      allowed: false,
      reason: "Cannot move to BLOCKED_DEPENDENCY without active dependencies register."
    };
  }

  // Nominally allowed
  return { allowed: true };
}

/**
 * Calculates execution pressure (saturation) of a specific stream.
 * Stream Pressure = (Sum of active estimated hours / weekly stream capacity) * 100
 */
export function calculateStreamPressure(
  tasks: Task[],
  streamTasks: Task[],
  capacityHours: number = 40
): number {
  if (capacityHours <= 0) return 0;
  
  const activeHours = streamTasks
    .filter(t => t.status !== 'done')
    .reduce((sum, t) => sum + (t.estimated_hours || 0), 0);

  return Number(((activeHours / capacityHours) * 100).toFixed(1));
}
