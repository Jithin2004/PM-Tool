import { Task, Profile } from '../../types';
import { ActionType } from './DecisionIntelligenceEngine';

export interface SimulatorState {
  tasks: Task[];
  profiles: Profile[];
  deliveryConfidence: number;
}

export interface SimulationResult {
  before: {
    deliveryConfidence: number;
    expectedCompletion?: string;
    overloadedUsers: number;
  };
  after: {
    deliveryConfidence: number;
    expectedCompletion?: string;
    overloadedUsers: number;
  };
  isDeterministic: boolean;
}

export function simulateActionImpact(
  currentState: SimulatorState,
  actionType: ActionType,
  actionPayload: any
): SimulationResult {
  const { tasks, profiles, deliveryConfidence } = currentState;
  
  // Base Before State
  const beforeOverloaded = profiles.filter(user => {
    const uTasks = tasks.filter(t => t.assignee_id === user.id && t.status !== 'done');
    const assignedHours = uTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
    const capacity = 40 * (user.availability_factor || 1.0);
    return assignedHours > capacity * 1.2;
  }).length;

  const result: SimulationResult = {
    before: {
      deliveryConfidence,
      overloadedUsers: beforeOverloaded,
    },
    after: {
      deliveryConfidence,
      overloadedUsers: beforeOverloaded,
    },
    isDeterministic: true
  };

  // Simulate Actions
  if (actionType === 'TASK_REASSIGNMENT') {
    const { source_user_id, target_user_id, tasks: targetTaskIds } = actionPayload;
    
    // Create cloned tasks for simulation
    const simulatedTasks = tasks.map(t => {
      if (targetTaskIds?.includes(t.id)) {
        return { ...t, assignee_id: target_user_id };
      }
      return t;
    });

    const afterOverloaded = profiles.filter(user => {
      const uTasks = simulatedTasks.filter(t => t.assignee_id === user.id && t.status !== 'done');
      const assignedHours = uTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
      const capacity = 40 * (user.availability_factor || 1.0);
      return assignedHours > capacity * 1.2;
    }).length;

    result.after.overloadedUsers = afterOverloaded;
    
    // Reassignment usually improves confidence if shifting from overloaded to underloaded
    if (afterOverloaded < beforeOverloaded) {
      result.after.deliveryConfidence = Math.min(100, deliveryConfidence + 12);
    }
  }

  if (actionType === 'BLOCKER_ESCALATION') {
    // Escalate blocker immediately boosts delivery confidence
    result.after.deliveryConfidence = Math.min(100, deliveryConfidence + 8);
  }

  if (actionType === 'DEADLINE_ADJUSTMENT') {
    // Shifting timeline reduces schedule risk but might not clear overload
    result.after.deliveryConfidence = Math.min(100, deliveryConfidence + 15);
  }

  return result;
}
