import { Task, Milestone } from '../types';
import { EntityDependency } from './timelineImpactEngine';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const dependencyValidator = {
  /**
   * Validates if a proposed dependency violates hierarchical rules.
   */
  validateDependency(
    sourceId: string,
    sourceType: 'task' | 'milestone' | 'project',
    targetId: string,
    targetType: 'task' | 'milestone' | 'project',
    tasks: Task[],
    milestones: Milestone[]
  ): ValidationResult {
    // Basic self-reference check
    if (sourceId === targetId) {
      return { isValid: false, error: 'Cannot depend on itself.' };
    }

    // Rule 1: Milestone A cannot depend on Task B if Task B belongs to Milestone A
    if (sourceType === 'milestone' && targetType === 'task') {
      const task = tasks.find(t => t.id === targetId);
      if (task && task.milestone_id === sourceId) {
        return { 
          isValid: false, 
          error: 'Hierarchy Violation: A Milestone cannot depend on a Task that it contains.' 
        };
      }
    }

    // Rule 2: Task cannot depend on its own parent milestone
    if (sourceType === 'task' && targetType === 'milestone') {
      const task = tasks.find(t => t.id === sourceId);
      if (task && task.milestone_id === targetId) {
        return { 
          isValid: false, 
          error: 'Hierarchy Violation: A Task cannot explicitly depend on its own parent Milestone.' 
        };
      }
    }

    // Rule 3: Cycle detection (including implicit hierarchy edges)
    const hasCycle = this.detectCycle(sourceId, targetId, tasks, milestones);
    if (hasCycle) {
      return { 
        isValid: false, 
        error: 'Hierarchy Violation: Dependency creates a direct or implicit cycle in the execution graph.' 
      };
    }

    return { isValid: true };
  },

  /**
   * Simulates inserting the edge and checks for cycles across the mixed DAG.
   */
  detectCycle(
    sourceId: string, 
    targetId: string, 
    tasks: Task[], 
    milestones: Milestone[]
  ): boolean {
    const graph = new Map<string, string[]>();

    // Build hierarchy edges natively
    tasks.forEach(t => {
      if (t.milestone_id) {
        // Milestone implicitly depends on its Tasks
        const mDeps = graph.get(t.milestone_id) || [];
        mDeps.push(t.id);
        graph.set(t.milestone_id, mDeps);
      }
    });

    // We only have the new edge to test here. 
    // In a full implementation, we'd add all existing task_dependencies to this graph first.
    // For now, we just test the immediate relationship.
    const deps = graph.get(sourceId) || [];
    deps.push(targetId);
    graph.set(sourceId, deps);

    // BFS cycle check
    const visited = new Set<string>();
    const queue = [sourceId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === targetId && visited.has(current)) {
        return true;
      }
      visited.add(current);
      
      const children = graph.get(current) || [];
      for (const child of children) {
        if (child === sourceId) return true; // Direct cycle back to source
        if (!visited.has(child)) {
          queue.push(child);
        }
      }
    }

    return false;
  }
};
