import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CommandUsageEvent {
  workspace_id: string;
  user_id?: string;
  command_id: string;
  command_type: string;
  route?: string;
  session_id?: string;
  metadata?: Record<string, any>;
}

export interface CommandTrend {
  command_id: string;
  command_type: string;
  label: string;
  count: number;
  trend: number;
}

export interface FrictionEvent {
  type: 'repeated_search' | 'route_bounce' | 'immediate_exit';
  severity: 'low' | 'medium' | 'high';
  description: string;
  from_route?: string;
  to_route?: string;
  search_term?: string;
  count: number;
  detected_at: string;
}

export interface WorkflowChain {
  path: string[];
  count: number;
  completion_pct: number;
}

export interface HealthScore {
  discoverability: number;
  efficiency: number;
  navigation_friction: number;
  overall: number;
  top_bottleneck: string;
}

export interface PredictiveSuggestion {
  command_id: string;
  label: string;
  score: number;
  reason: string;
}

// ── Session ────────────────────────────────────────────────────────────────────

let currentSessionId: string | null = null;

export function getSessionId(): string {
  if (!currentSessionId) {
    currentSessionId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  return currentSessionId;
}

export function resetSessionId(): void {
  currentSessionId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Storage Keys ───────────────────────────────────────────────────────────────

const TIMELINE_CACHE_KEY = 'resolve-command-timeline-v2';
const USAGE_CACHE_KEY = 'resolve-command-usage-v2';
const FRICTION_CACHE_KEY = 'resolve-command-friction';
const MAX_CACHED = 2000;

// ── Local cache helpers ────────────────────────────────────────────────────────

function getCache<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function setCache<T>(key: string, data: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(data.slice(-MAX_CACHED))); } catch { /* ignore */ }
}

// ── Record Command Usage ───────────────────────────────────────────────────────

export async function recordUsage(event: CommandUsageEvent): Promise<boolean> {
  // Always cache locally first
  const cached = getCache<CommandUsageEvent & { ts: number }>(TIMELINE_CACHE_KEY);
  cached.push({ ...event, ts: Date.now() });
  setCache(TIMELINE_CACHE_KEY, cached);

  // Increment local usage counter
  try {
    const raw = localStorage.getItem(USAGE_CACHE_KEY);
    const usage: Record<string, number> = raw ? JSON.parse(raw) : {};
    const key = `${event.command_type}:${event.command_id}`;
    usage[key] = (usage[key] || 0) + 1;
    localStorage.setItem(USAGE_CACHE_KEY, JSON.stringify(usage));
  } catch { /* ignore */ }

  // Write to Supabase
  if (!isSupabaseConfigured || !event.workspace_id) return false;
  try {
    const { error } = await supabase.from('command_usage_events').insert({
      workspace_id: event.workspace_id,
      user_id: event.user_id,
      command_id: event.command_id,
      command_type: event.command_type,
      route: event.route,
      session_id: event.session_id || getSessionId(),
      metadata: event.metadata || {},
    });
    return !error;
  } catch { return false; }
}

// ── Fetch Usage from Supabase ──────────────────────────────────────────────────

interface UsageRow {
  command_id: string;
  command_type: string;
  count?: number;
  route: string | null;
  session_id: string | null;
  timestamp: string;
  user_id: string | null;
}

async function fetchUsageRows(workspaceId: string, userId?: string, days = 14): Promise<UsageRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    let query = supabase
      .from('command_usage_events')
      .select('command_id, command_type, route, session_id, timestamp, user_id')
      .eq('workspace_id', workspaceId)
      .gte('timestamp', since)
      .order('timestamp', { ascending: true });
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (!error && data) return data as UsageRow[];
  } catch { /* fall through */ }
  return [];
}

// ── Get Cached Timeline (localStorage fallback) ────────────────────────────────

export function getCachedTimeline(): (CommandUsageEvent & { ts: number })[] {
  return getCache<CommandUsageEvent & { ts: number }>(TIMELINE_CACHE_KEY);
}

// ── Get Top Commands with Trend ────────────────────────────────────────────────

export async function getTopCommandsWithTrend(
  workspaceId: string,
  userId?: string,
  limit = 5,
  role = 'viewer',
): Promise<CommandTrend[]> {
  // Fetch from Supabase
  const rows = await fetchUsageRows(workspaceId, userId);

  if (rows.length === 0) {
    // Fallback to local cache
    const cached = getCachedTimeline();
    if (cached.length === 0) return [];
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    const recent = cached.filter(e => now - e.ts < week);
    const prior = cached.filter(e => now - e.ts >= week && now - e.ts < 2 * week);
    const recentCounts: Record<string, { count: number; type: string }> = {};
    const priorCounts: Record<string, number> = {};
    recent.forEach(e => { const k = `${e.command_type}:${e.command_id}`; if (!recentCounts[k]) recentCounts[k] = { count: 0, type: e.command_type }; recentCounts[k].count++; });
    prior.forEach(e => { const k = `${e.command_type}:${e.command_id}`; priorCounts[k] = (priorCounts[k] || 0) + 1; });
    return Object.entries(recentCounts).sort(([, a], [, b]) => b.count - a.count).slice(0, limit).map(([id, info]) => ({
      command_id: id, command_type: info.type, label: id.split(':').slice(1).join(':'), count: info.count,
      trend: priorCounts[id] ? Math.round(((info.count - priorCounts[id]) / priorCounts[id]) * 100) : 0,
    }));
  }

  // Process Supabase data
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  const recent = rows.filter(r => now - new Date(r.timestamp).getTime() < week);
  const prior = rows.filter(r => {
    const t = now - new Date(r.timestamp).getTime();
    return t >= week && t < 2 * week;
  });

  const recentCounts: Record<string, { count: number; type: string }> = {};
  const priorCounts: Record<string, number> = {};
  recent.forEach(r => {
    const k = `${r.command_type}:${r.command_id}`;
    if (!recentCounts[k]) recentCounts[k] = { count: 0, type: r.command_type };
    recentCounts[k].count++;
  });
  prior.forEach(r => {
    const k = `${r.command_type}:${r.command_id}`;
    priorCounts[k] = (priorCounts[k] || 0) + 1;
  });

  return Object.entries(recentCounts).sort(([, a], [, b]) => b.count - a.count).slice(0, limit).map(([id, info]) => ({
    command_id: id, command_type: info.type, label: id.split(':').slice(1).join(':'), count: info.count,
    trend: priorCounts[id] ? Math.round(((info.count - priorCounts[id]) / priorCounts[id]) * 100) : 0,
  }));
}

// ── Friction Detection ─────────────────────────────────────────────────────────

export async function detectFriction(workspaceId: string, userId?: string): Promise<FrictionEvent[]> {
  const rows = await fetchUsageRows(workspaceId, userId, 7);
  const friction: FrictionEvent[] = [];

  if (rows.length < 5) {
    // Fallback: check local cache
    const cached = getCachedTimeline();
    if (cached.length < 5) return [];
    // Convert cached events
    const cachedRows = cached.map(c => ({ command_id: c.command_id, command_type: c.command_type, route: c.route || null, session_id: c.session_id || null, timestamp: new Date(c.ts).toISOString(), user_id: c.user_id }));
    return detectFrictionFromRows(cachedRows);
  }

  return detectFrictionFromRows(rows);
}

function detectFrictionFromRows(rows: UsageRow[]): FrictionEvent[] {
  const friction: FrictionEvent[] = [];

  // 1. Repeated searches — same command_type=search within 60s window
  const searches: { term: string; ts: number; route: string }[] = [];
  rows.forEach(r => {
    if (r.command_type === 'search' || r.command_type === 'query') {
      searches.push({ term: r.command_id, ts: new Date(r.timestamp).getTime(), route: r.route || '' });
    }
  });
  for (let i = 1; i < searches.length; i++) {
    if (searches[i].term === searches[i - 1].term && searches[i].ts - searches[i - 1].ts < 60000) {
      friction.push({
        type: 'repeated_search', severity: 'medium',
        description: `"${searches[i].term}" searched repeatedly`,
        search_term: searches[i].term, count: 2, detected_at: new Date(searches[i].ts).toISOString(),
      });
    }
  }

  // 2. Route bouncing — A → B → A within 120s
  const navigations = rows.filter(r => r.command_type === 'navigation' && r.route);
  for (let i = 2; i < navigations.length; i++) {
    const a = navigations[i - 2];
    const b = navigations[i - 1];
    const c = navigations[i];
    if (a.route === c.route && a.route !== b.route) {
      const tsA = new Date(a.timestamp).getTime();
      const tsC = new Date(c.timestamp).getTime();
      if (tsC - tsA < 120000) {
        friction.push({
          type: 'route_bounce', severity: 'high',
          description: `${a.route?.split('/').filter(Boolean).pop()} → ${b.route?.split('/').filter(Boolean).pop()} → ${a.route?.split('/').filter(Boolean).pop()}`,
          from_route: a.route, to_route: b.route, count: 3, detected_at: c.timestamp,
        });
      }
    }
  }

  // 3. Immediate exits — navigate to route then within 30s navigate to different section
  for (let i = 1; i < navigations.length; i++) {
    const prev = navigations[i - 1];
    const curr = navigations[i];
    if (prev.route !== curr.route) {
      const tsDiff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
      if (tsDiff < 30000 && tsDiff > 2000) {
        friction.push({
          type: 'immediate_exit', severity: 'low',
          description: `${prev.route?.split('/').filter(Boolean).pop()} opened and exited rapidly`,
          from_route: prev.route, to_route: curr.route, count: 1, detected_at: curr.timestamp,
        });
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return friction.filter(f => {
    const key = `${f.type}|${f.description}|${f.detected_at}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
}

// ── Workflow Path Discovery ────────────────────────────────────────────────────

export async function getWorkflowChains(workspaceId: string, userId?: string): Promise<WorkflowChain[]> {
  const rows = await fetchUsageRows(workspaceId, userId, 30);
  if (rows.length < 5) {
    const cached = getCachedTimeline();
    if (cached.length < 5) return [];
    const cachedRows = cached.map(c => ({ command_id: c.command_id, command_type: c.command_type, route: c.route || null, session_id: c.session_id || null, timestamp: new Date(c.ts).toISOString(), user_id: c.user_id }));
    return computeChains(cachedRows);
  }
  return computeChains(rows);
}

function computeChains(rows: UsageRow[]): WorkflowChain[] {
  // Group by session
  const sessions: Record<string, UsageRow[]> = {};
  rows.forEach(r => {
    const sid = r.session_id || 'default';
    if (!sessions[sid]) sessions[sid] = [];
    sessions[sid].push(r);
  });

  const chainCounts: Record<string, { count: number; starts: number }> = {};

  Object.values(sessions).forEach(sessionRows => {
    sessionRows.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const labels = sessionRows.map(r => {
      const label = r.command_id.split(':').slice(1).join(':') || r.command_id;
      return label;
    });

    // 2-step chains
    for (let i = 0; i < labels.length - 1; i++) {
      const chainKey = `${labels[i]} → ${labels[i + 1]}`;
      if (!chainCounts[chainKey]) chainCounts[chainKey] = { count: 0, starts: 0 };
      chainCounts[chainKey].count++;
      if (i === 0) chainCounts[chainKey].starts++;
    }

    // 3-step chains
    for (let i = 0; i < labels.length - 2; i++) {
      const chainKey = `${labels[i]} → ${labels[i + 1]} → ${labels[i + 2]}`;
      if (!chainCounts[chainKey]) chainCounts[chainKey] = { count: 0, starts: 0 };
      chainCounts[chainKey].count++;
      if (i === 0) chainCounts[chainKey].starts++;
    }
  });

  return Object.entries(chainCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([pathStr, info]) => {
      const path = pathStr.split(' → ');
      const completion_pct = info.starts > 0 ? Math.round((info.count / info.starts) * 100) : 100;
      return { path, count: info.count, completion_pct: Math.min(completion_pct, 100) };
    });
}

// ── Health Score ───────────────────────────────────────────────────────────────

export async function getHealthScore(workspaceId: string, userId?: string, role = 'viewer'): Promise<HealthScore | null> {
  const rows = await fetchUsageRows(workspaceId, userId, 30);
  if (rows.length < 10) {
    const cached = getCachedTimeline();
    if (cached.length < 10) return null;
    return computeHealthScore(cached.map(c => ({ command_id: c.command_id, command_type: c.command_type, route: c.route || null, session_id: c.session_id || null, timestamp: new Date(c.ts).toISOString(), user_id: c.user_id })), role);
  }
  return computeHealthScore(rows, role);
}

function computeHealthScore(rows: UsageRow[], role: string): HealthScore {
  const totalNav = rows.filter(r => r.command_type === 'navigation').length;
  const totalActions = rows.filter(r => r.command_type === 'action' || r.command_type === 'ai_nlp' || r.command_type === 'ai').length;
  const uniqueFeatures = new Set(rows.map(r => r.command_id)).size;
  const totalEntries = rows.length;

  // Efficiency: actions per navigation
  const efficiency = totalNav > 0 ? Math.min(Math.round((totalActions / totalNav) * 100), 100) : 50;

  // Discoverability: unique features used vs expected available (estimate: 50 feature IDs)
  const expectedFeatures = role === 'viewer' ? 15 : role === 'pm' ? 30 : 50;
  const discoverability = Math.min(Math.round((uniqueFeatures / expectedFeatures) * 100), 100);

  // Navigation friction: repeated navigations / total navigations
  const navLabels = rows.filter(r => r.command_type === 'navigation').map(r => r.command_id);
  const navSet = new Set(navLabels);
  const repeatedNav = navLabels.length - navSet.size;
  const navigationFriction = navLabels.length > 0 ? Math.min(Math.round((repeatedNav / navLabels.length) * 100), 100) : 0;

  // Overall
  const overall = Math.round((efficiency * 0.4 + discoverability * 0.35 + (100 - navigationFriction) * 0.25));

  // Top bottleneck
  let topBottleneck = 'None detected';
  if (navigationFriction > 30) topBottleneck = 'Navigation repetition';
  else if (discoverability < 40) topBottleneck = 'Feature discovery';
  else if (efficiency < 30) topBottleneck = 'Low action conversion';

  return { discoverability, efficiency, navigation_friction: navigationFriction, overall, top_bottleneck: topBottleneck };
}

// ── Predictive Suggestions V2 ──────────────────────────────────────────────────

const TIME_BUCKET_LABELS: Record<string, string[]> = {
  morning: ['Sprint Center', 'Execution Board', 'Timeline Engine', 'Capacity'],
  afternoon: ['Timeline Engine', 'Gantt Workspace', 'Teams', 'Work Logs'],
  evening: ['Decision Center', 'Analytics', 'Settings'],
};

const ROLE_SUGGESTIONS: Record<string, string[]> = {
  super_admin: ['Admin', 'Audit', 'Analytics', 'Settings'],
  pm: ['Sprint Center', 'Capacity', 'Timeline Engine', 'Teams'],
  developer: ['Execution Board', 'Work Logs', 'Gantt Workspace'],
  viewer: ['Analytics', 'Execution Board'],
};

export async function getPredictiveSuggestions(
  workspaceId: string,
  userId?: string,
  role = 'viewer',
  currentRoute?: string,
): Promise<PredictiveSuggestion[]> {
  const rows = await fetchUsageRows(workspaceId, userId, 14);
  const cacheFallback = rows.length < 5;
  const allRows = cacheFallback ? getCachedTimeline().map(c => ({ command_id: c.command_id, command_type: c.command_type, route: c.route || null, session_id: c.session_id || null, timestamp: new Date(c.ts).toISOString(), user_id: c.user_id })) : rows;

  // Compute scores
  const scores: Record<string, { score: number; reasons: string[]; label: string }> = {};
  const now = new Date();
  const hour = now.getHours();
  const timeBucket = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  // 1. Frequency weight
  const freqCounts: Record<string, number> = {};
  allRows.forEach(r => {
    const key = r.command_id.split(':').slice(1).join(':') || r.command_id;
    freqCounts[key] = (freqCounts[key] || 0) + 1;
  });

  // 2. Recency weight (last 3 days boost)
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const recentSet = new Set<string>();
  allRows.forEach(r => {
    if (new Date(r.timestamp).getTime() > threeDaysAgo) {
      const key = r.command_id.split(':').slice(1).join(':') || r.command_id;
      recentSet.add(key);
    }
  });

  // 3. Chain weight (last command → likely next)
  const chainSuggestions = new Set<string>();
  if (allRows.length >= 2) {
    const lastId = allRows[allRows.length - 1].command_id.split(':').slice(1).join(':') || allRows[allRows.length - 1].command_id;
    const transitions: Record<string, Record<string, number>> = {};
    for (let i = 0; i < allRows.length - 1; i++) {
      const from = allRows[i].command_id.split(':').slice(1).join(':') || allRows[i].command_id;
      const to = allRows[i + 1].command_id.split(':').slice(1).join(':') || allRows[i + 1].command_id;
      if (!transitions[from]) transitions[from] = {};
      transitions[from][to] = (transitions[from][to] || 0) + 1;
    }
    if (transitions[lastId]) {
      Object.entries(transitions[lastId]).sort(([, a], [, b]) => b - a).slice(0, 3).forEach(([next]) => chainSuggestions.add(next));
    }
  }

  // Combine weights
  const timeLabels = TIME_BUCKET_LABELS[timeBucket] || [];
  const roleLabels = ROLE_SUGGESTIONS[role] || [];

  Object.entries(freqCounts).forEach(([label, count]) => {
    if (!scores[label]) scores[label] = { score: 0, reasons: [], label };
    scores[label].score += count * 2;
    scores[label].reasons.push(`Used ${count}x`);
  });

  recentSet.forEach(label => {
    if (!scores[label]) scores[label] = { score: 0, reasons: [], label };
    scores[label].score += 10;
    scores[label].reasons.push('Recently used');
  });

  chainSuggestions.forEach(label => {
    if (!scores[label]) scores[label] = { score: 0, reasons: [], label };
    scores[label].score += 8;
    scores[label].reasons.push('Workflow chain');
  });

  timeLabels.forEach(label => {
    if (!scores[label]) scores[label] = { score: 0, reasons: [], label };
    scores[label].score += 5;
    if (!scores[label].reasons.includes(`Best for ${timeBucket}`)) scores[label].reasons.push(`Best for ${timeBucket}`);
  });

  roleLabels.forEach(label => {
    if (!scores[label]) scores[label] = { score: 0, reasons: [], label };
    scores[label].score += 6;
    if (!scores[label].reasons.includes(`Role-based`)) scores[label].reasons.push(`Role-based`);
  });

  // Current route context — suggest related
  if (currentRoute) {
    const routeParts = currentRoute.split('/').filter(Boolean);
    if (routeParts[0] === 'execution') {
      const related = ['Sprint Center', 'Timeline Engine', 'Gantt Workspace'];
      related.forEach(label => {
        if (!scores[label]) scores[label] = { score: 0, reasons: [], label };
        scores[label].score += 4;
        if (!scores[label].reasons.includes('Context related')) scores[label].reasons.push('Context related');
      });
    }
  }

  return Object.values(scores)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(s => ({ command_id: s.label, label: s.label, score: s.score, reason: s.reasons.slice(0, 2).join(' · ') }));
}
