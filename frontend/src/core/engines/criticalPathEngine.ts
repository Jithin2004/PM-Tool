import type { Task, Milestone } from '../../types';
import type { DependencyLink } from '../../services/dependencyService';

export interface PathNode {
  taskId: string;
  duration: number;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  slack: number;
  isCritical: boolean;
}

export const criticalPathEngine = {
  /**
   * Calculates the critical path for a set of tasks based on their dependencies.
   * Tasks on the critical path have zero slack (or float) and directly impact the project deadline.
   */
  calculateCriticalPath(tasks: Task[], dependencies: DependencyLink[]): Map<string, PathNode> {
    const nodeMap = new Map<string, PathNode>();
    const forwardGraph = new Map<string, string[]>();
    const reverseGraph = new Map<string, string[]>();

    // Initialize nodes
    for (const t of tasks) {
      const startMs = t.start_date ? new Date(t.start_date).getTime() : 0;
      const endMs = t.deadline ? new Date(t.deadline).getTime() : startMs + (t.estimated_hours * 3600000);
      const duration = Math.max(1, endMs - startMs);

      nodeMap.set(t.id, {
        taskId: t.id,
        duration,
        earlyStart: 0,
        earlyFinish: 0,
        lateStart: Infinity,
        lateFinish: Infinity,
        slack: 0,
        isCritical: false
      });
    }

    // Build graphs
    for (const link of dependencies) {
      if (link.source_type === 'task' && link.target_type === 'task') {
        const src = link.source_id;
        const tgt = link.target_id;
        
        if (!forwardGraph.has(src)) forwardGraph.set(src, []);
        forwardGraph.get(src)!.push(tgt);
        
        if (!reverseGraph.has(tgt)) reverseGraph.set(tgt, []);
        reverseGraph.get(tgt)!.push(src);
      }
    }

    // Forward Pass
    const topoOrder = this.topologicalSort(tasks.map(t => t.id), forwardGraph);
    
    for (const taskId of topoOrder) {
      const node = nodeMap.get(taskId)!;
      const preds = reverseGraph.get(taskId) || [];
      
      let maxEarlyFinish = 0; // Default start time
      for (const p of preds) {
        const pNode = nodeMap.get(p);
        if (pNode && pNode.earlyFinish > maxEarlyFinish) {
          maxEarlyFinish = pNode.earlyFinish;
        }
      }
      
      node.earlyStart = maxEarlyFinish;
      node.earlyFinish = node.earlyStart + node.duration;
    }

    // Find Project Duration
    let maxProjectEnd = 0;
    for (const node of nodeMap.values()) {
      if (node.earlyFinish > maxProjectEnd) maxProjectEnd = node.earlyFinish;
    }

    // Backward Pass
    const revOrder = [...topoOrder].reverse();
    for (const taskId of revOrder) {
      const node = nodeMap.get(taskId)!;
      const succs = forwardGraph.get(taskId) || [];
      
      if (succs.length === 0) {
        node.lateFinish = maxProjectEnd;
      } else {
        let minLateStart = Infinity;
        for (const s of succs) {
          const sNode = nodeMap.get(s);
          if (sNode && sNode.lateStart < minLateStart) {
            minLateStart = sNode.lateStart;
          }
        }
        node.lateFinish = minLateStart;
      }
      
      node.lateStart = node.lateFinish - node.duration;
      node.slack = node.lateStart - node.earlyStart;
      
      // Critical path items have zero slack (with some tiny buffer tolerance)
      node.isCritical = Math.abs(node.slack) <= 1000;
    }

    return nodeMap;
  },

  topologicalSort(nodes: string[], graph: Map<string, string[]>): string[] {
    const inDegree = new Map<string, number>();
    nodes.forEach(n => inDegree.set(n, 0));
    
    for (const [_, targets] of graph.entries()) {
      for (const tgt of targets) {
        if (inDegree.has(tgt)) {
          inDegree.set(tgt, inDegree.get(tgt)! + 1);
        }
      }
    }
    
    const queue: string[] = [];
    for (const [node, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(node);
    }
    
    const order: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      order.push(current);
      
      const succs = graph.get(current) || [];
      for (const s of succs) {
        if (inDegree.has(s)) {
          const newDeg = inDegree.get(s)! - 1;
          inDegree.set(s, newDeg);
          if (newDeg === 0) queue.push(s);
        }
      }
    }
    
    // Add any remaining nodes (in case of cycles that slipped through, though they shouldn't exist)
    for (const node of nodes) {
      if (!order.includes(node)) order.push(node);
    }
    
    return order;
  }
};
