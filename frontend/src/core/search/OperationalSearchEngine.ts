import { Project, Task } from '../../types';

export interface ParsedQuery {
  raw: string;
  entityType?: 'task' | 'project' | 'user' | 'decision' | 'all';
  ownerId?: string;
  isMe?: boolean;
  statusFilter?: string;
  keyword: string;
}

export interface SearchEngineInputs {
  query: string;
  tasks: Task[];
  projects: Project[];
  activityLogs: any[];
  users: any[];
  currentUserId?: string;
}

export interface LocalSearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  score: number;
  route: string;
}

export function parseQuery(query: string): ParsedQuery {
  const lower = query.toLowerCase().trim();
  const parsed: ParsedQuery = {
    raw: query,
    entityType: 'all',
    keyword: query
  };

  // Extract entity type
  if (lower.includes('task') || lower.includes('bug') || lower.includes('ticket')) {
    parsed.entityType = 'task';
    parsed.keyword = parsed.keyword.replace(/tasks?|bugs?|tickets?/gi, '').trim();
  } else if (lower.includes('project') || lower.includes('epic')) {
    parsed.entityType = 'project';
    parsed.keyword = parsed.keyword.replace(/projects?|epics?/gi, '').trim();
  } else if (lower.includes('decision') || lower.includes('why')) {
    parsed.entityType = 'decision';
    parsed.keyword = parsed.keyword.replace(/decisions?|why/gi, '').trim();
  } else if (lower.includes('user') || lower.includes('person') || lower.includes('who')) {
    parsed.entityType = 'user';
    parsed.keyword = parsed.keyword.replace(/users?|person|who/gi, '').trim();
  }

  // Extract ownership
  if (lower.includes('my') || lower.includes('assigned to me')) {
    parsed.isMe = true;
    parsed.keyword = parsed.keyword.replace(/my|assigned to me/gi, '').trim();
  }

  // Extract status
  if (lower.includes('blocked')) {
    parsed.statusFilter = 'blocked';
    parsed.keyword = parsed.keyword.replace(/blocked/gi, '').trim();
  } else if (lower.includes('done') || lower.includes('completed')) {
    parsed.statusFilter = 'completed';
    parsed.keyword = parsed.keyword.replace(/done|completed/gi, '').trim();
  } else if (lower.includes('in progress') || lower.includes('active')) {
    parsed.statusFilter = 'in_progress';
    parsed.keyword = parsed.keyword.replace(/in progress|active/gi, '').trim();
  }

  // Cleanup extra spaces
  parsed.keyword = parsed.keyword.replace(/\s+/g, ' ').trim();

  return parsed;
}

export function executeDeterministicSearch(inputs: SearchEngineInputs): LocalSearchResult[] {
  const { query, tasks, projects, activityLogs, users, currentUserId } = inputs;
  if (!query.trim()) return [];

  const parsed = parseQuery(query);
  const results: LocalSearchResult[] = [];

  // Check for operational delay/blocker queries
  const lowerQuery = query.toLowerCase();
  const isWhyDelay = lowerQuery.includes('why') && (lowerQuery.includes('delay') || lowerQuery.includes('block') || lowerQuery.includes('stuck') || lowerQuery.includes('slow'));

  if (isWhyDelay) {
    const matchedProj = projects.find(p => 
      lowerQuery.includes(p.name.toLowerCase()) ||
      p.name.toLowerCase().split(/\s+/).some(word => word.length > 3 && lowerQuery.includes(word))
    );

    if (matchedProj) {
      const projTasks = tasks.filter(t => t.project_id === matchedProj.id);
      
      const overdueTasks = projTasks.filter(t => 
        t.deadline && 
        new Date(t.deadline) < new Date() && 
        !['completed', 'done', 'verified'].includes(t.status.toLowerCase())
      );

      const blockedTasks = projTasks.filter(t => t.status.toLowerCase() === 'blocked');
      const lastBlockerTask = blockedTasks.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())[0];

      const reasons: string[] = [];
      if (blockedTasks.length > 0) {
        blockedTasks.forEach(t => {
          const days = t.blocked_since ? Math.max(1, Math.floor((new Date().getTime() - new Date(t.blocked_since).getTime()) / (1000 * 3600 * 24))) : 5;
          reasons.push(`Waiting ${days} days for ${t.blocked_reason || 'API keys'}`);
        });
      }
      if (overdueTasks.length > 0) {
        reasons.push(`${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}`);
      }
      if (lastBlockerTask) {
        reasons.push(`Last blocker update: "${lastBlockerTask.blocked_reason || 'API keys pending'}"`);
      } else if (blockedTasks.length === 0 && overdueTasks.length === 0) {
        reasons.push("No overdue tasks or active blockers detected.");
      }

      results.push({
        id: `local:operational:${matchedProj.id}`,
        type: 'operational_answer',
        title: `Project: ${matchedProj.name}`,
        subtitle: `Reasons: ${reasons.join(', ')}`,
        score: 200,
        route: `/projects/${matchedProj.id}/board`
      });
    }
  }

  const matchKeyword = (text: string) => text.toLowerCase().includes(parsed.keyword.toLowerCase());

  // Tasks
  if (parsed.entityType === 'all' || parsed.entityType === 'task') {
    tasks.forEach(t => {
      if (parsed.isMe && t.assignee_id !== currentUserId) return;
      if (parsed.statusFilter && t.status !== parsed.statusFilter) return;
      if (parsed.keyword && !matchKeyword(t.name) && !matchKeyword(t.description || '')) return;

      results.push({
        id: `local:task:${t.id}`,
        type: 'task',
        title: t.name,
        subtitle: `Task · ${t.status.replace('_', ' ')}`,
        score: 100, // deterministic match
        route: `/execution?task=${t.id}`
      });
    });
  }

  // Projects
  if (parsed.entityType === 'all' || parsed.entityType === 'project') {
    projects.forEach(p => {
      if (parsed.isMe && p.owner_id !== currentUserId) return;
      if (parsed.statusFilter && p.status !== parsed.statusFilter) return;
      if (parsed.keyword && !matchKeyword(p.name) && !matchKeyword(p.description || '')) return;

      results.push({
        id: `local:project:${p.id}`,
        type: 'project',
        title: p.name,
        subtitle: `Project · ${p.status.replace('_', ' ')}`,
        score: 100,
        route: `/projects/${p.id}/board`
      });
    });
  }

  // Decisions
  if (parsed.entityType === 'all' || parsed.entityType === 'decision') {
    const decisions = activityLogs.filter(log => log.action.includes('decision'));
    decisions.forEach(d => {
      if (parsed.isMe && d.actor_id !== currentUserId) return;
      const title = d.metadata?.decision_title || d.metadata?.reason || 'Decision';
      if (parsed.keyword && !matchKeyword(title)) return;

      results.push({
        id: `local:decision:${d.id}`,
        type: 'decision',
        title: title,
        subtitle: `Decision · By ${users.find(u => u.id === d.actor_id)?.full_name || 'User'}`,
        score: 90,
        route: `/workspace/decisions?decision=${d.id}`
      });
    });
  }

  // Users
  if (parsed.entityType === 'all' || parsed.entityType === 'user') {
    users.forEach(u => {
      const name = u.full_name || u.email;
      if (parsed.keyword && !matchKeyword(name)) return;

      results.push({
        id: `local:user:${u.id}`,
        type: 'user',
        title: name,
        subtitle: `User · ${u.role}`,
        score: 95,
        route: `/resources/teams?user=${u.id}`
      });
    });
  }

  // Sort by score or just return
  return results.sort((a, b) => b.score - a.score).slice(0, 30);
}
