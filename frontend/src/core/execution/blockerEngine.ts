import type { ExecutionBlocker, ExecutionDependency } from '../types';

export interface FrictionMetrics {
  averageDurationHours: number;
  infrastructureInstability: number; // percentage (0 - 100)
  coordinationLatency: number;       // percentage (0 - 100)
  externalDependencyPressure: number; // percentage (0 - 100)
  totalActiveCount: number;
  totalResolvedCount: number;
}

/**
 * Validates whether adding a dependency would create a circular reference cycle (deadlock) in the DAG.
 * Returns true if a cycle is detected, false if it is safe to add.
 */
export function hasCircularDependency(
  newDependency: { task_id: string; depends_on_task_id: string },
  existingDependencies: ExecutionDependency[]
): boolean {
  // Map dependencies into an adjacency list (task_id -> array of depends_on_task_id)
  const adjList = new Map<string, string[]>();
  
  // Add existing active dependencies
  existingDependencies.forEach(d => {
    if (!adjList.has(d.task_id)) {
      adjList.set(d.task_id, []);
    }
    adjList.get(d.task_id)!.push(d.depends_on_task_id);
  });

  // Add the proposed new dependency
  if (!adjList.has(newDependency.task_id)) {
    adjList.set(newDependency.task_id, []);
  }
  adjList.get(newDependency.task_id)!.push(newDependency.depends_on_task_id);

  // DFS Cycle Detection (recursion stack tracking)
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(node: string): boolean {
    if (recStack.has(node)) return true; // Cycle detected!
    if (visited.has(node)) return false;

    visited.add(node);
    recStack.add(node);

    const neighbors = adjList.get(node) || [];
    for (const neighbor of neighbors) {
      if (dfs(neighbor)) return true;
    }

    recStack.delete(node);
    return false;
  }

  // Check all nodes in the adjacency list to handle disconnected components
  for (const node of adjList.keys()) {
    if (dfs(node)) return true;
  }

  return false;
}

/**
 * Computes deep execution friction metrics across all registered workspace blockers.
 * Tracks coordination latency, infrastructure instability, and dependency pressure.
 */
export function calculateFrictionMetrics(blockers: ExecutionBlocker[]): FrictionMetrics {
  const activeBlockers = blockers.filter(b => !b.resolved);
  const resolvedBlockers = blockers.filter(b => b.resolved);
  
  // 1. Calculate Average Blocker Duration (in hours)
  let totalHours = 0;
  let resolvedCount = 0;

  resolvedBlockers.forEach(b => {
    if (b.resolved_at) {
      const durationMs = new Date(b.resolved_at).getTime() - new Date(b.created_at).getTime();
      const durationHours = Math.max(0.1, durationMs / (1000 * 60 * 60));
      totalHours += durationHours;
      resolvedCount++;
    }
  });

  const averageDurationHours = resolvedCount > 0 ? Number((totalHours / resolvedCount).toFixed(1)) : 0;

  // 2. Group and track blocker pressure proportions
  const totalCount = blockers.length;
  if (totalCount === 0) {
    return {
      averageDurationHours: 0,
      infrastructureInstability: 0,
      coordinationLatency: 0,
      externalDependencyPressure: 0,
      totalActiveCount: 0,
      totalResolvedCount: 0
    };
  }

  const infraCount = blockers.filter(b => b.category === 'infrastructure' || b.category === 'access').length;
  const coordCount = blockers.filter(b => b.category === 'approval' || b.category === 'client').length;
  const depCount = blockers.filter(b => b.category === 'dependency' || b.category === 'data').length;

  return {
    averageDurationHours,
    infrastructureInstability: Number(((infraCount / totalCount) * 100).toFixed(1)),
    coordinationLatency: Number(((coordCount / totalCount) * 100).toFixed(1)),
    externalDependencyPressure: Number(((depCount / totalCount) * 100).toFixed(1)),
    totalActiveCount: activeBlockers.length,
    totalResolvedCount: resolvedBlockers.length
  };
}

/**
 * Tracks recurring blocker counts to identify operational delivery hot-spots.
 */
export function trackRecurringBlockers(blockers: ExecutionBlocker[]): Record<string, number> {
  const counts: Record<string, number> = {
    client: 0,
    data: 0,
    infrastructure: 0,
    approval: 0,
    dependency: 0,
    access: 0
  };

  blockers.forEach(b => {
    if (counts[b.category] !== undefined) {
      counts[b.category]++;
    }
  });

  return counts;
}
