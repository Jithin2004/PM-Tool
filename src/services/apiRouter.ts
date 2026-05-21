import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';
import { verifyApiKey } from './apiKeyService';
import { evaluateTriggers } from './automationEngine';

interface ApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  headers: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
}

interface ApiResponse {
  statusCode: number;
  body: any;
}

const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW = 60000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

async function authenticateRequest(req: ApiRequest): Promise<{ wsId?: string; error?: ApiResponse }> {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { error: { statusCode: 401, body: { error: 'Missing or invalid Authorization header' } } };
  }
  const apiKey = authHeader.slice(7);
  const keyData = await verifyApiKey(apiKey);
  if (!keyData.valid) {
    return { error: { statusCode: 401, body: { error: 'Invalid or revoked API key' } } };
  }
  const wsId = (req.headers['x-workspace-id'] || req.query?.workspace_id || keyData.workspaceId || '') as string;
  if (!wsId) {
    return { error: { statusCode: 400, body: { error: 'x-workspace-id header or workspace-scoped API key required' } } };
  }
  return { wsId };
}

async function handleProjects(req: ApiRequest, wsId: string): Promise<ApiResponse> {
  switch (req.method) {
    case 'GET': {
      const { data } = await supabase.from('projects').select('*').eq('workspace_id', wsId).order('created_at', { ascending: false });
      return { statusCode: 200, body: data || [] };
    }
    case 'POST': {
      const { data } = await supabase.from('projects').insert({ ...req.body, workspace_id: wsId }).select().single();
      return { statusCode: data ? 201 : 400, body: data || { error: 'Failed to create project' } };
    }
    default: return { statusCode: 405, body: { error: 'Method not allowed' } };
  }
}

async function handleTasks(req: ApiRequest, wsId: string): Promise<ApiResponse> {
  switch (req.method) {
    case 'GET': {
      let query = supabase.from('tasks').select('*').eq('workspace_id', wsId).is('deleted_at', null);
      if (req.query?.project_id) query = query.eq('project_id', req.query.project_id);
      if (req.query?.status) query = query.eq('status', req.query.status);
      if (req.query?.assignee_id) query = query.eq('assignee_id', req.query.assignee_id);
      const { data } = await query.order('created_at', { ascending: false });
      return { statusCode: 200, body: data || [] };
    }
    case 'POST': {
      const { data } = await supabase.from('tasks').insert({ ...req.body, workspace_id: wsId }).select().single();
      if (data) {
        evaluateTriggers('task.created', { workspace_id: wsId, task_id: data.id, ...req.body }).catch(() => {});
      }
      return { statusCode: data ? 201 : 400, body: data || { error: 'Failed to create task' } };
    }
    case 'PATCH': {
      const taskId = req.path.split('/').pop();
      if (!taskId) return { statusCode: 400, body: { error: 'Task ID required' } };
      const { data } = await supabase.from('tasks').update(req.body).eq('id', taskId).eq('workspace_id', wsId).select().single();
      if (data) {
        evaluateTriggers('task.status_changed', { workspace_id: wsId, task_id: taskId, ...req.body }).catch(() => {});
      }
      return { statusCode: data ? 200 : 404, body: data || { error: 'Task not found' } };
    }
    default: return { statusCode: 405, body: { error: 'Method not allowed' } };
  }
}

async function handleDocuments(req: ApiRequest, wsId: string): Promise<ApiResponse> {
  switch (req.method) {
    case 'GET': {
      let query = supabase.from('documents').select('*').eq('workspace_id', wsId).is('deleted_at', null);
      if (req.query?.search) query = query.ilike('title', `%${req.query.search}%`);
      const { data } = await query.order('created_at', { ascending: false });
      return { statusCode: 200, body: data || [] };
    }
    case 'POST': {
      const { data } = await supabase.from('documents').insert({ ...req.body, workspace_id: wsId }).select().single();
      if (data) {
        evaluateTriggers('document.created', { workspace_id: wsId, doc_id: data.id, ...req.body }).catch(() => {});
      }
      return { statusCode: data ? 201 : 400, body: data || { error: 'Failed to create document' } };
    }
    default: return { statusCode: 405, body: { error: 'Method not allowed' } };
  }
}

async function handleCalendar(req: ApiRequest, wsId: string): Promise<ApiResponse> {
  switch (req.method) {
    case 'GET': {
      let query = supabase.from('calendar_events').select('*').eq('workspace_id', wsId);
      if (req.query?.start_date) query = query.gte('start_date', req.query.start_date);
      if (req.query?.end_date) query = query.lte('end_date', req.query.end_date);
      const { data } = await query.order('start_date', { ascending: true });
      return { statusCode: 200, body: data || [] };
    }
    case 'POST': {
      const { data } = await supabase.from('calendar_events').insert({ ...req.body, workspace_id: wsId }).select().single();
      if (data) {
        evaluateTriggers('calendar_event.added', { workspace_id: wsId, event_id: data.id, ...req.body }).catch(() => {});
      }
      return { statusCode: data ? 201 : 400, body: data || { error: 'Failed to create event' } };
    }
    default: return { statusCode: 405, body: { error: 'Method not allowed' } };
  }
}

async function handleApprovals(req: ApiRequest, wsId: string): Promise<ApiResponse> {
  switch (req.method) {
    case 'GET': {
      let query = supabase.from('approval_instances').select('*, approval_chains(name)').eq('approval_chains.workspace_id', wsId);
      if (req.query?.status) query = query.eq('status', req.query.status);
      if (req.query?.target_type) query = query.eq('target_type', req.query.target_type);
      const { data } = await query.order('created_at', { ascending: false });
      return { statusCode: 200, body: data || [] };
    }
    default: return { statusCode: 405, body: { error: 'Method not allowed' } };
  }
}

async function handleAutomation(req: ApiRequest, wsId: string): Promise<ApiResponse> {
  switch (req.method) {
    case 'GET': {
      const { data } = await supabase.from('automation_rules').select('*').eq('workspace_id', wsId).eq('enabled', true);
      return { statusCode: 200, body: data || [] };
    }
    case 'POST': {
      const { data } = await supabase.from('automation_rules').insert({ ...req.body, workspace_id: wsId }).select().single();
      return { statusCode: data ? 201 : 400, body: data || { error: 'Failed to create rule' } };
    }
    default: return { statusCode: 405, body: { error: 'Method not allowed' } };
  }
}

const ROUTE_MAP: Record<string, (req: ApiRequest, wsId: string) => Promise<ApiResponse>> = {
  '/api/v1/projects': handleProjects,
  '/api/v1/tasks': handleTasks,
  '/api/v1/documents': handleDocuments,
  '/api/v1/calendar': handleCalendar,
  '/api/v1/approvals': handleApprovals,
  '/api/v1/automation': handleAutomation,
};

function matchRoute(path: string): { handler?: (req: ApiRequest, wsId: string) => Promise<ApiResponse>; matchedPath?: string } {
  const clean = path.replace(/\/+$/, '');
  for (const [route, handler] of Object.entries(ROUTE_MAP)) {
    if (clean === route || clean.startsWith(route + '/')) {
      return { handler, matchedPath: route };
    }
  }
  return {};
}

export async function handleApiRequest(req: ApiRequest): Promise<ApiResponse> {
  if (!isSupabaseConfigured) {
    return { statusCode: 503, body: { error: 'Database not configured' } };
  }
  const { handler, matchedPath } = matchRoute(req.path);
  if (!handler) {
    return { statusCode: 404, body: { error: 'Endpoint not found' } };
  }
  const key = req.headers['authorization']?.slice(7) || 'anonymous';
  if (!checkRateLimit(key)) {
    return { statusCode: 429, body: { error: 'Rate limit exceeded (100/min)' } };
  }
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;
  const apiWsId = auth.wsId!;
  try {
    const result = await handler(req, apiWsId);
    activityLogService.logApiRequest(apiWsId, matchedPath!, req.method, result.statusCode).catch(() => {});
    return result;
  } catch (e: any) {
    return { statusCode: 500, body: { error: e.message || 'Internal server error' } };
  }
}
