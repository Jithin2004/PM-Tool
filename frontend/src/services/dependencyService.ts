import { supabase } from '../lib/supabase';
import type { Task, Milestone } from '../types';

export type DependencyType = 'finish_to_start' | 'start_to_start' | 'blocks' | 'related';

export interface DependencyMetadata {
  type: DependencyType;
  lag_days?: number;
}

export interface DependencyLink {
  id: string;
  source_type: 'task' | 'milestone';
  source_id: string;
  target_type: 'task' | 'milestone';
  target_id: string;
  relationship_type: string; // usually 'depends_on' or 'blocks'
  metadata: DependencyMetadata;
  created_at?: string;
}

export const dependencyService = {
  /**
   * Get all dependencies within a workspace for tasks/milestones
   */
  async getDependencies(workspaceId: string): Promise<DependencyLink[]> {
    const { data, error } = await supabase
      .from('entity_links')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('source_type', ['task', 'milestone'])
      .in('target_type', ['task', 'milestone']);

    if (error) throw error;
    
    return data.map(d => ({
      ...d,
      metadata: typeof d.metadata === 'string' ? JSON.parse(d.metadata) : d.metadata
    }));
  },

  /**
   * Creates a dependency, returning the new link
   */
  async createDependency(
    workspaceId: string,
    sourceType: 'task' | 'milestone',
    sourceId: string,
    targetType: 'task' | 'milestone',
    targetId: string,
    type: DependencyType,
    lagDays: number = 0
  ): Promise<DependencyLink> {
    // 1. Fetch current graph to validate cycle
    const currentLinks = await this.getDependencies(workspaceId);
    
    // 2. Validate cycle
    const hasCycle = this.validateDependency(currentLinks, sourceId, targetId);
    if (hasCycle) {
      throw new Error('Dependency creates a circular chain.');
    }

    const relationship_type = type === 'blocks' ? 'blocks' : 'depends_on';

    const { data, error } = await supabase
      .from('entity_links')
      .insert({
        workspace_id: workspaceId,
        source_type: sourceType,
        source_id: sourceId,
        target_type: targetType,
        target_id: targetId,
        relationship_type,
        metadata: { type, lag_days: lagDays }
      })
      .select()
      .single();

    if (error) throw error;
    return {
      ...data,
      metadata: typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata
    };
  },

  async removeDependency(linkId: string): Promise<void> {
    const { error } = await supabase
      .from('entity_links')
      .delete()
      .eq('id', linkId);

    if (error) throw error;
  },

  /**
   * Check if adding (target -> depends on -> source) creates a cycle
   * Meaning: can we reach `targetId` from `sourceId` downstream?
   * If yes, then making targetId depend on sourceId closes the loop.
   */
  validateDependency(existingLinks: DependencyLink[], sourceId: string, targetId: string): boolean {
    if (sourceId === targetId) return true;

    // build forward adjacency list: node -> array of nodes that depend on it
    const graph = new Map<string, string[]>();
    
    for (const link of existingLinks) {
      const src = link.source_id; // the one being depended ON
      const tgt = link.target_id; // the dependent
      const deps = graph.get(src) || [];
      deps.push(tgt);
      graph.set(src, deps);
    }

    // BFS to see if targetId is reachable from sourceId
    const queue = [targetId];
    const visited = new Set<string>([targetId]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === sourceId) {
        return true; // Cycle detected
      }

      const dependents = graph.get(current) || [];
      for (const next of dependents) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }

    return false;
  },

  /**
   * Calculate full downstream dependency chain
   */
  calculateDependencyChain(existingLinks: DependencyLink[], startId: string): string[] {
    const graph = new Map<string, string[]>();
    for (const link of existingLinks) {
      const deps = graph.get(link.source_id) || [];
      deps.push(link.target_id);
      graph.set(link.source_id, deps);
    }

    const result: string[] = [];
    const queue = [startId];
    const visited = new Set<string>([startId]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const dependents = graph.get(current) || [];
      for (const next of dependents) {
        if (!visited.has(next)) {
          visited.add(next);
          result.push(next);
          queue.push(next);
        }
      }
    }

    return result;
  }
};
