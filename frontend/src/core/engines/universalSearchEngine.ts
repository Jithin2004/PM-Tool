import { searchIndexService } from '../../services/searchIndexService';
import { hasCapability } from '../auth/permissions';
import { workspaceMemberCache } from './workspaceMemberCache';

export interface SearchResult {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  content: string;
  metadata: Record<string, any>;
  rank: number;
}

export const universalSearchEngine = {
  async executeSearch(workspaceId: string, currentUserRole: string, rawQuery: string, limit = 20): Promise<SearchResult[]> {
    if (!rawQuery || rawQuery.trim().length < 2) return [];

    let query = rawQuery.trim();
    const filters: string[] = [];

    // Parse type filters e.g., type:task
    const typeMatch = query.match(/type:(\w+)/i);
    if (typeMatch) {
      filters.push(typeMatch[1].toLowerCase());
      query = query.replace(typeMatch[0], '').trim();
    }

    // Parse person filters e.g., @Arun
    const personMatch = query.match(/@(\w+)/i);
    if (personMatch) {
      const pName = personMatch[1].toLowerCase();
      const members = workspaceMemberCache.getMembers(workspaceId);
      const user = members.find(m => m.full_name?.toLowerCase().includes(pName) || m.email.split('@')[0].toLowerCase() === pName);
      if (user) {
        // If a person is mentioned, let's boost search by appending their ID to query text, 
        // assuming it's in the metadata payload for assignee etc.
        query += ` ${user.id}`;
      }
      query = query.replace(personMatch[0], '').trim();
    }

    if (query.length < 2 && filters.length === 0) return []; // Only type/person filter is left

    const results = await searchIndexService.searchWorkspace(workspaceId, query, filters, limit * 2);

    // Filter results through Role Intelligence
    // Strip records users shouldn't discover
    const filtered = results.filter((res: SearchResult) => this.isEntityVisibleToRole(res, currentUserRole));

    // Sort by role relevance
    filtered.sort((a: SearchResult, b: SearchResult) => {
      return this.getRoleRelevanceMultiplier(b, currentUserRole) - this.getRoleRelevanceMultiplier(a, currentUserRole) || b.rank - a.rank;
    });

    return filtered.slice(0, limit);
  },

  isEntityVisibleToRole(entity: SearchResult, role: string): boolean {
    if (hasCapability(role as any, 'workspace.update')) return true;

    // Financial Data
    if (entity.entity_type === 'invoice' || entity.entity_type === 'finance' || entity.entity_type === 'ledger') {
      return hasCapability(role, 'finance.manage') || hasCapability(role, 'finance.manage');
    }

    // HR Data
    if (entity.entity_type === 'hr' || entity.entity_type === 'salary' || entity.entity_type === 'attendance') {
      return hasCapability(role, 'people.manage');
    }

    // If it's a general entity like task, epic, project, it is typically visible if they are in the workspace
    // Note: Project visibility based on team is handled separately, but standard search indexes all projects.
    return true;
  },

  getRoleRelevanceMultiplier(entity: SearchResult, role: string): number {
    // Developers care most about Tasks and Documents
    if (!hasCapability(role, 'project.update')) {
      if (entity.entity_type === 'task') return 1.5;
      if (entity.entity_type === 'document') return 1.2;
    }

    // PMs care about Projects, Risks, Sprints, Epics
    if (hasCapability(role, 'project.update') && !hasCapability(role, 'settings.manage')) {
      if (['project', 'epic', 'sprint', 'risk'].includes(entity.entity_type)) return 1.5;
    }

    // Finance/HR cares about invoices/people
    if (hasCapability(role, 'finance.manage') && entity.entity_type === 'invoice') return 1.5;
    if (hasCapability(role, 'people.manage') && entity.entity_type === 'user') return 1.5;

    return 1.0;
  }
};




