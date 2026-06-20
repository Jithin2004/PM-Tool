import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';
import { getCapabilities } from '../core/auth/permissions';
import type { UserRole } from '../types';

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

export interface TelemetryStats {
  queueSize: number;
  totalFlushed: number;
  totalRetried: number;
  totalFailed: number;
  flushDurationMs: number;
  lastFlushAt: number | null;
}

// ── Stable Session ─────────────────────────────────────────────────────────────

const SESSION_KEY = 'resolve-session-id';

let cachedSessionId: string | null = null;

function generateSessionId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function initSession(): string {
  if (cachedSessionId) return cachedSessionId;
  let stored: string | null = null;
  try { stored = localStorage.getItem(SESSION_KEY); } catch { /* ignore */ }
  if (stored) {
    cachedSessionId = stored;
    return cachedSessionId;
  }
  const fresh = generateSessionId();
  try { localStorage.setItem(SESSION_KEY, fresh); } catch { /* ignore */ }
  cachedSessionId = fresh;
  // Immutable log
  activityLogService.appendLog({
    workspace_id: '',
    actor_id: undefined,
    action_type: 'session_created',
    metadata: { session_id: fresh },
  });
  return fresh;
}

export function getSessionId(): string {
  return cachedSessionId || initSession();
}

export function clearSession(): void {
  cachedSessionId = null;
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  drainQueue();
}

// ── Telemetry Queue ────────────────────────────────────────────────────────────

interface QueueEntry {
  event: CommandUsageEvent;
  retryCount: number;
  dedupKey: string;
  queuedAt: number;
}

let queue: QueueEntry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let isFlushing = false;

const FLUSH_INTERVAL = 5000;
const MAX_BATCH = 10;
const DEDUP_WINDOW_MS = 2000;
const MAX_RETRIES = 3;

const stats: TelemetryStats = {
  queueSize: 0,
  totalFlushed: 0,
  totalRetried: 0,
  totalFailed: 0,
  flushDurationMs: 0,
  lastFlushAt: null,
};

function dedupKey(event: CommandUsageEvent): string {
  const slot = Math.floor(Date.now() / DEDUP_WINDOW_MS) * DEDUP_WINDOW_MS;
  return `${event.command_type}::${event.command_id}::${slot}`;
}

function enqueueTelemetry(event: CommandUsageEvent): void {
  const key = dedupKey(event);
  // Dedup: skip if same event+command+time-window already in queue
  if (queue.some(e => e.dedupKey === key)) return;
  queue.push({ event, retryCount: 0, dedupKey: key, queuedAt: Date.now() });
  stats.queueSize = queue.length;
  if (queue.length >= MAX_BATCH) {
    flushTelemetry();
  }
  if (!flushTimer) startFlushTimer();
  if (import.meta.env.DEV) {
  }
}

function startFlushTimer(): void {
  flushTimer = setInterval(flushTelemetry, FLUSH_INTERVAL);
}

function stopFlushTimer(): void {
  if (flushTimer !== null) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

async function flushTelemetry(): Promise<void> {
  if (isFlushing || queue.length === 0) return;
  isFlushing = true;
  const start = performance.now();
  const batch = queue.splice(0, MAX_BATCH);
  const failed: QueueEntry[] = [];
  let flushed = 0;

  if (!isSupabaseConfigured) {
    // Re-insert at front for retry
    queue.unshift(...batch);
    stats.queueSize = queue.length;
    isFlushing = false;
    return;
  }

  for (const entry of batch) {
    try {
      const { error } = await supabase.from('command_usage_events').insert({
        workspace_id: entry.event.workspace_id,
        user_id: entry.event.user_id,
        command_id: entry.event.command_id,
        command_type: entry.event.command_type,
        route: entry.event.route,
        session_id: entry.event.session_id || getSessionId(),
        metadata: entry.event.metadata || {},
      });
      if (error) {
        entry.retryCount++;
        if (entry.retryCount < MAX_RETRIES) failed.push(entry);
        stats.totalRetried++;
        if (import.meta.env.DEV) {
        }
      } else {
        flushed++;
        stats.totalFlushed++;
      }
    } catch {
      entry.retryCount++;
      if (entry.retryCount < MAX_RETRIES) failed.push(entry);
      stats.totalRetried++;
    }
  }

  // Re-add failed entries to front of queue
  queue.unshift(...failed);
  stats.queueSize = queue.length;
  stats.flushDurationMs = Math.round(performance.now() - start);
  stats.lastFlushAt = Date.now();

  if (queue.length === 0) stopFlushTimer();

  // Immutable log for successful flushes
  if (flushed > 0) {
    activityLogService.appendLog({
      workspace_id: batch[0]?.event.workspace_id || '',
      actor_id: batch[0]?.event.user_id,
      action_type: 'telemetry_flush',
      metadata: { flushed, retried: batch.length - flushed - failed.length, failed: failed.length, duration_ms: stats.flushDurationMs },
    });
  }

  // Log retries if any events exhausted retries
  const exhausted = batch.filter(e => e.retryCount >= MAX_RETRIES);
  if (exhausted.length > 0) {
    stats.totalFailed += exhausted.length;
    activityLogService.appendLog({
      workspace_id: exhausted[0]?.event.workspace_id || '',
      actor_id: exhausted[0]?.event.user_id,
      action_type: 'telemetry_retry',
      metadata: { exhausted: exhausted.length, command_types: exhausted.map(e => e.event.command_type) },
    });
  }

  if (import.meta.env.DEV) {
  }

  isFlushing = false;
}

function drainQueue(): void {
  stopFlushTimer();
  if (queue.length > 0) {
    if (import.meta.env.DEV) {
    }
    queue = [];
    stats.queueSize = 0;
  }
}

// ── Lifecycle Hooks ────────────────────────────────────────────────────────────

function setupLifecycleHooks(): void {
  if (typeof window === 'undefined') return;
  // Flush on page unload
  window.addEventListener('beforeunload', () => {
    if (queue.length > 0) {
      // Synchronous sendBeacon fallback — best-effort
      try {
        const payload = queue.slice(0, MAX_BATCH).map(e => ({
          workspace_id: e.event.workspace_id,
          command_id: e.event.command_id,
          command_type: e.event.command_type,
          route: e.event.route,
          session_id: e.event.session_id || cachedSessionId,
        }));
        navigator.sendBeacon('/api/telemetry', JSON.stringify(payload));
      } catch { /* ignore */ }
    }
  });
  // Flush on visibility change (tab hidden → flush)
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && queue.length > 0) {
      flushTelemetry();
    }
  });
  // Flush on reconnect
  window.addEventListener('online', () => {
    if (queue.length > 0) flushTelemetry();
  });
}

// Init session and lifecycle hooks on module load
initSession();
setupLifecycleHooks();

// ── Record Command Usage (batched) ─────────────────────────────────────────────

export function recordUsage(event: CommandUsageEvent): void {
  const sessionId = event.session_id || getSessionId();

  // Always cache locally first
  try {
    const cached = getCache<CommandUsageEvent & { ts: number }>(TIMELINE_CACHE_KEY);
    cached.push({ ...event, session_id: sessionId, ts: Date.now() });
    setCache(TIMELINE_CACHE_KEY, cached);
  } catch { /* ignore */ }

  // Increment local usage counter
  try {
    const raw = localStorage.getItem(USAGE_CACHE_KEY);
    const usage: Record<string, number> = raw ? JSON.parse(raw) : {};
    usage[`${event.command_type}:${event.command_id}`] = (usage[`${event.command_type}:${event.command_id}`] || 0) + 1;
    localStorage.setItem(USAGE_CACHE_KEY, JSON.stringify(usage));
  } catch { /* ignore */ }

  // Enqueue for batched Supabase write
  if (isSupabaseConfigured && event.workspace_id) {
    enqueueTelemetry({ ...event, session_id: sessionId });
  }
}

// ── Flush API (for manual / logout triggers) ───────────────────────────────────

export function flushNow(): Promise<void> {
  return flushTelemetry();
}

// ── Observability ──────────────────────────────────────────────────────────────

export function getTelemetryStats(): TelemetryStats {
  return { ...stats, queueSize: queue.length };
}

// ── Storage Keys ───────────────────────────────────────────────────────────────

const TIMELINE_CACHE_KEY = 'resolve-command-timeline-v2';
const USAGE_CACHE_KEY = 'resolve-command-usage-v2';
const MAX_CACHED = 2000;

// ── Local cache helpers ────────────────────────────────────────────────────────

function getCache<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function setCache<T>(key: string, data: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(data.slice(-MAX_CACHED))); } catch { /* ignore */ }
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
  const rows = await fetchUsageRows(workspaceId, userId);

  if (rows.length === 0) {
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

// ── Friction Detection ─────────────────────────────────────────────────────────

export async function detectFriction(workspaceId: string, userId?: string): Promise<FrictionEvent[]> {
  const rows = await fetchUsageRows(workspaceId, userId, 7);
  if (rows.length < 5) {
    const cached = getCachedTimeline();
    if (cached.length < 5) return [];
    const mapped = cached.map(c => ({ command_id: c.command_id, command_type: c.command_type, route: c.route || null, session_id: c.session_id || null, timestamp: new Date(c.ts).toISOString(), user_id: c.user_id }));
    return detectFrictionFromRows(mapped);
  }
  return detectFrictionFromRows(rows);
}

function detectFrictionFromRows(rows: UsageRow[]): FrictionEvent[] {
  const friction: FrictionEvent[] = [];
  const searches: { term: string; ts: number; route: string }[] = [];
  rows.forEach(r => {
    if (r.command_type === 'search' || r.command_type === 'query') {
      searches.push({ term: r.command_id, ts: new Date(r.timestamp).getTime(), route: r.route || '' });
    }
  });
  for (let i = 1; i < searches.length; i++) {
    if (searches[i].term === searches[i - 1].term && searches[i].ts - searches[i - 1].ts < 60000) {
      friction.push({ type: 'repeated_search', severity: 'medium', description: `"${searches[i].term}" searched repeatedly`, search_term: searches[i].term, count: 2, detected_at: new Date(searches[i].ts).toISOString() });
    }
  }

  const navigations = rows.filter(r => r.command_type === 'navigation' && r.route);
  for (let i = 2; i < navigations.length; i++) {
    const a = navigations[i - 2], b = navigations[i - 1], c = navigations[i];
    if (a.route === c.route && a.route !== b.route) {
      const tsA = new Date(a.timestamp).getTime(), tsC = new Date(c.timestamp).getTime();
      if (tsC - tsA < 120000) {
        friction.push({ type: 'route_bounce', severity: 'high',
          description: `${a.route?.split('/').filter(Boolean).pop()} → ${b.route?.split('/').filter(Boolean).pop()} → ${a.route?.split('/').filter(Boolean).pop()}`,
          from_route: a.route, to_route: b.route, count: 3, detected_at: c.timestamp });
      }
    }
  }

  for (let i = 1; i < navigations.length; i++) {
    const prev = navigations[i - 1], curr = navigations[i];
    if (prev.route !== curr.route) {
      const tsDiff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
      if (tsDiff < 30000 && tsDiff > 2000) {
        friction.push({ type: 'immediate_exit', severity: 'low',
          description: `${prev.route?.split('/').filter(Boolean).pop()} opened and exited rapidly`,
          from_route: prev.route, to_route: curr.route, count: 1, detected_at: curr.timestamp });
      }
    }
  }

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
    const mapped = cached.map(c => ({ command_id: c.command_id, command_type: c.command_type, route: c.route || null, session_id: c.session_id || null, timestamp: new Date(c.ts).toISOString(), user_id: c.user_id }));
    return computeChains(mapped);
  }
  return computeChains(rows);
}

function computeChains(rows: UsageRow[]): WorkflowChain[] {
  const sessions: Record<string, UsageRow[]> = {};
  rows.forEach(r => {
    const sid = r.session_id || 'default';
    if (!sessions[sid]) sessions[sid] = [];
    sessions[sid].push(r);
  });

  const chainCounts: Record<string, { count: number; starts: number }> = {};
  Object.values(sessions).forEach(sessionRows => {
    sessionRows.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const labels = sessionRows.map(r => r.command_id.split(':').slice(1).join(':') || r.command_id);

    for (let i = 0; i < labels.length - 1; i++) {
      const key = `${labels[i]} → ${labels[i + 1]}`;
      if (!chainCounts[key]) chainCounts[key] = { count: 0, starts: 0 };
      chainCounts[key].count++;
      if (i === 0) chainCounts[key].starts++;
    }
    for (let i = 0; i < labels.length - 2; i++) {
      const key = `${labels[i]} → ${labels[i + 1]} → ${labels[i + 2]}`;
      if (!chainCounts[key]) chainCounts[key] = { count: 0, starts: 0 };
      chainCounts[key].count++;
      if (i === 0) chainCounts[key].starts++;
    }
  });

  return Object.entries(chainCounts).sort(([, a], [, b]) => b.count - a.count).slice(0, 10).map(([pathStr, info]) => {
    const path = pathStr.split(' → ');
    return { path, count: info.count, completion_pct: Math.min(info.starts > 0 ? Math.round((info.count / info.starts) * 100) : 100, 100) };
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
  const efficiency = totalNav > 0 ? Math.min(Math.round((totalActions / totalNav) * 100), 100) : 50;
  const capCount = getCapabilities(role as UserRole).length;
  const expectedFeatures = capCount > 0 ? Math.max(15, capCount * 2) : 15;
  const discoverability = Math.min(Math.round((uniqueFeatures / expectedFeatures) * 100), 100);
  const navLabels = rows.filter(r => r.command_type === 'navigation').map(r => r.command_id);
  const navSet = new Set(navLabels);
  const navigationFriction = navLabels.length > 0 ? Math.min(Math.round(((navLabels.length - navSet.size) / navLabels.length) * 100), 100) : 0;
  const overall = Math.round(efficiency * 0.4 + discoverability * 0.35 + (100 - navigationFriction) * 0.25);
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
  workspaceId: string, userId?: string, role = 'viewer', currentRoute?: string,
): Promise<PredictiveSuggestion[]> {
  const rows = await fetchUsageRows(workspaceId, userId, 14);
  const cacheFallback = rows.length < 5;
  const allRows = cacheFallback
    ? getCachedTimeline().map(c => ({ command_id: c.command_id, command_type: c.command_type, route: c.route || null, session_id: c.session_id || null, timestamp: new Date(c.ts).toISOString(), user_id: c.user_id }))
    : rows;

  const scores: Record<string, { score: number; reasons: string[]; label: string }> = {};
  const now = new Date();
  const hour = now.getHours();
  const timeBucket = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  const freqCounts: Record<string, number> = {};
  allRows.forEach(r => {
    const key = r.command_id.split(':').slice(1).join(':') || r.command_id;
    freqCounts[key] = (freqCounts[key] || 0) + 1;
  });

  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const recentSet = new Set<string>();
  allRows.forEach(r => {
    if (new Date(r.timestamp).getTime() > threeDaysAgo) {
      recentSet.add(r.command_id.split(':').slice(1).join(':') || r.command_id);
    }
  });

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

  if (currentRoute) {
    const routeParts = currentRoute.split('/').filter(Boolean);
    if (routeParts[0] === 'execution') {
      ['Sprint Center', 'Timeline Engine', 'Gantt Workspace'].forEach(label => {
        if (!scores[label]) scores[label] = { score: 0, reasons: [], label };
        scores[label].score += 4;
        if (!scores[label].reasons.includes('Context related')) scores[label].reasons.push('Context related');
      });
    }
  }

  return Object.values(scores).sort((a, b) => b.score - a.score).slice(0, 5)
    .map(s => ({ command_id: s.label, label: s.label, score: s.score, reason: s.reasons.slice(0, 2).join(' · ') }));
}
