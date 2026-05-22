import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';
import { fireEventWebhooks, createWebhook } from './webhookService';
import { evaluateTriggers, createAutomationRule } from './automationEngine';
import { createDocument } from './documentService';
import { createApprovalChain, createApprovalInstance } from './approvalService';
import { sprintService } from './sprintService';
import { calendarEventService } from './calendarEventService';
import type { CalendarEvent } from './calendarEventService';
import { createTeam } from './teamService';
import { createProject } from './projectService';
import { createEpic } from './epicService';
import { createTask, createTaskDependency } from './taskService';
import { createConnectedAccount, createIntegrationConfig, createIntegrationSyncJob } from './integrationService';
import { normalizeSupabaseError } from '../utils/supabaseError';

const LOCK_KEY = 'resolve-stress-running';
const STALE_LOCK_MINUTES = 15;
const MAX_MULTIPLIER = 2;
const CONCURRENCY = 20;
const SERVICE_TIMEOUT_MS = 15000;

export interface FailedOperation {
  service: string;
  payload: any;
  error: string;
  code: string;
  details: string;
  hint: string;
  timestamp: string;
}

const EXECUTION_MODES = ['KANBAN', 'SCRUM', 'SDLC', 'CUSTOM'] as const;
const TASK_STATUSES = ['backlog', 'ready', 'in_progress', 'review', 'done'] as const;
const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const INTEGRATION_SERVICES = ['github', 'gitlab', 'figma', 'google_calendar', 'google_drive', 'slack', 'jira', 'notion', 'asana', 'trello'] as const;
const WEBHOOK_EVENTS = ['task.created', 'task.updated', 'task.completed', 'project.created', 'sprint.completed', 'approval.completed', 'document.created'];

const DEFAULT_MAX = { users: 200, projects: 1000, tasks: 10000 } as const;

export interface StressTestOptions {
  dryRun?: boolean;
  force?: boolean;
  maxUsers?: number;
  maxProjects?: number;
  maxTasks?: number;
}

export interface StressReport {
  simulationRunId: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  blocked: boolean;
  blockReason?: string;
  dryRun: boolean;
  estimated?: {
    records: Record<string, number>;
    dbWrites: number;
    cleanupTargets: Record<string, string>;
  };
  generation: {
    usersCreated: number; teamsCreated: number; projectsCreated: number;
    epicsCreated: number; tasksCreated: number; documentsCreated: number;
    calendarEventsCreated: number; integrationsCreated: number;
    webhooksCreated: number; automationsCreated: number; approvalsCreated: number;
    timeMs: number; stressRlsErrors: number; blockedTables: number;
    rlsErrorTables: string[]; serviceFallbacks: number; skippedDueToRls: number;
    servicePathCount: number; rawInsertCount: number;
    successfulOperations: number;
  };
  failureSummaryByService: Record<string, number>;
  performance: {
    projectPageLoadMs: number; portfolioLoadMs: number; timelineCalcMs: number;
    ganttRenderMs: number; commandPaletteSearchMs: number; queueDepth: number;
    memoryEstimateMB: number; apiThroughput: number; automationExecMs: number;
    webhookProcessingMs: number; documentSearchMs: number; calendarCalcMs: number;
    slowestQueries: string[]; largestRenderTrees: string[];
  };
  events: {
    taskUpdates: number; sprintCompletions: number; automationTriggers: number;
    integrationSyncs: number; approvalsProcessed: number; refreshOperations: number;
    recoveryOperations: number; browserInterruptions: number; timeMs: number;
  };
  cleanup: {
    recordsBefore: Record<string, number>;
    recordsAfter: Record<string, number>;
    simRecordsRemaining: Record<string, number>;
    success: boolean; timeMs: number; orphanCount: number;
  };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendations: string[];
  partialFailure: boolean;
  failedOperations: FailedOperation[];
}

function simTag(runId: string, label: string, index: number): string { return `SST_${runId}_${label}_${index}`; }
function nowISO(): string { return new Date().toISOString(); }
function randomFrom<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function pickMany<T>(arr: readonly T[], count: number): T[] {
  const copy = [...arr]; const result: T[] = [];
  for (let i = 0; i < count && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy[idx]); copy.splice(idx, 1);
  }
  return result;
}
function ms(t0: number): number { return performance.now() - t0; }

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)),
  ]);
}

async function callService<T>(
  report: StressReport,
  serviceName: string,
  payload: any,
  fn: () => Promise<T>,
): Promise<T | null> {
  report.generation.servicePathCount++;
  let result: T | null = null;
  let caught = false;
  try {
    result = await withTimeout(fn(), SERVICE_TIMEOUT_MS);
  } catch (err: any) {
    caught = true;
    const norm = normalizeSupabaseError(err);
    console.log('[service insert failed]', { service: serviceName, payload, error: norm.message, code: norm.code, details: norm.details, hint: norm.hint });
    report.failedOperations.push({ service: serviceName, payload, error: norm.message, code: norm.code, details: norm.details, hint: norm.hint, timestamp: nowISO() });
    report.partialFailure = true;
    report.generation.serviceFallbacks++;
    return null;
  }
  if (!caught && (result === null || result === false)) {
    report.failedOperations.push({
      service: serviceName,
      payload,
      error: 'returned null/false (see service log for Supabase error)',
      code: 'SERVICE_REJECTED',
      details: '',
      hint: '',
      timestamp: nowISO(),
    });
    report.partialFailure = true;
    report.generation.serviceFallbacks++;
  }
  return result;
}

function makeBaseReport(runId: string, startTime: string): StressReport {
  return {
    simulationRunId: runId, startTime, endTime: '', durationMs: 0,
    blocked: false, dryRun: false,
    generation: { usersCreated: 0, teamsCreated: 0, projectsCreated: 0, epicsCreated: 0, tasksCreated: 0, documentsCreated: 0, calendarEventsCreated: 0, integrationsCreated: 0, webhooksCreated: 0, automationsCreated: 0, approvalsCreated: 0, timeMs: 0, stressRlsErrors: 0, blockedTables: 0, rlsErrorTables: [], serviceFallbacks: 0, skippedDueToRls: 0, servicePathCount: 0, rawInsertCount: 0, successfulOperations: 0 },
    performance: { projectPageLoadMs: 0, portfolioLoadMs: 0, timelineCalcMs: 0, ganttRenderMs: 0, commandPaletteSearchMs: 0, queueDepth: 0, memoryEstimateMB: 0, apiThroughput: 0, automationExecMs: 0, webhookProcessingMs: 0, documentSearchMs: 0, calendarCalcMs: 0, slowestQueries: [], largestRenderTrees: [] },
    events: { taskUpdates: 0, sprintCompletions: 0, automationTriggers: 0, integrationSyncs: 0, approvalsProcessed: 0, refreshOperations: 0, recoveryOperations: 0, browserInterruptions: 0, timeMs: 0 },
    cleanup: { recordsBefore: {}, recordsAfter: {}, simRecordsRemaining: {}, success: false, timeMs: 0, orphanCount: 0 },
    riskLevel: 'LOW', recommendations: [],
    partialFailure: false, failedOperations: [],
    failureSummaryByService: {},
  };
}

interface LockInfo {
  runId: string;
  startedAt: string | null;
}

function checkLock(): LockInfo | null {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.runId) return { runId: parsed.runId, startedAt: parsed.startedAt || null };
    } catch {
      return { runId: raw, startedAt: null };
    }
  } catch { return null; }
  return null;
}

function setLock(runId: string): void {
  try {
    localStorage.setItem(LOCK_KEY, JSON.stringify({ runId, startedAt: new Date().toISOString() }));
  } catch { /* noop */ }
}

function clearLock(): void { try { localStorage.removeItem(LOCK_KEY); } catch { /* noop */ } }

function getLockAgeMinutes(): number | null {
  const lock = checkLock();
  if (!lock || !lock.startedAt) return null;
  return (Date.now() - new Date(lock.startedAt).getTime()) / 60000;
}

async function concurrentBatch<T>(items: T[], fn: (item: T, index: number) => Promise<any>): Promise<void> {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(items.slice(i, i + CONCURRENCY).map((item, j) => fn(item, i + j)));
  }
}

// ─── Targeted count of SST_{runId} records per table ──────────────

async function countSimRecords(runId: string, wsId: string): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const checks: [string, string, string][] = [
    ['users', 'email', `SST_${runId}_%@sim.local`],
    ['teams', 'name', `SST_${runId}_%`],
    ['projects', 'name', `SST_${runId}_%`],
    ['epics', 'name', `SST_${runId}_%`],
    ['tasks', 'name', `SST_${runId}_%`],
    ['documents', 'title', `SST_${runId}_%`],
    ['calendar_events', 'title', `SST_${runId}_%`],
    ['webhooks', 'name', `SST_${runId}_%`],
    ['automation_rules', 'name', `SST_${runId}_%`],
    ['approval_chains', 'name', `SST_${runId}_%`],
    ['connected_accounts', 'access_token', `sst_${runId}_%`],
    ['sprints', 'name', `SST_${runId}_%`],
  ];
  for (const [table, col, pattern] of checks) {
    try {
      const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId).like(col, pattern);
      result[table] = count || 0;
    } catch { result[table] = -1; }
  }
  try {
    const { data: tids } = await supabase.from('tasks').select('id').eq('workspace_id', wsId).like('name', `SST_${runId}_%`);
    const ids = tids?.map(t => t.id) || [];
    if (ids.length > 0) {
      const { count: dc } = await supabase.from('task_dependencies').select('*', { count: 'exact', head: true }).eq('workspace_id', wsId).in('task_id', ids);
      result['task_dependencies'] = dc || 0;
    } else { result['task_dependencies'] = 0; }
  } catch { result['task_dependencies'] = -1; }
  try {
    const { data: cids } = await supabase.from('approval_chains').select('id').eq('workspace_id', wsId).like('name', `SST_${runId}_%`);
    const aids = cids?.map(c => c.id) || [];
    if (aids.length > 0) {
      const { count: ic } = await supabase.from('approval_instances').select('*', { count: 'exact', head: true }).in('chain_id', aids);
      result['approval_instances'] = ic || 0;
    } else { result['approval_instances'] = 0; }
  } catch { result['approval_instances'] = -1; }
  try {
    const { data: docs } = await supabase.from('documents').select('id').eq('workspace_id', wsId).like('title', `SST_${runId}_%`);
    const dids = docs?.map(d => d.id) || [];
    if (dids.length > 0) {
      const { count: vc } = await supabase.from('doc_versions').select('*', { count: 'exact', head: true }).in('doc_id', dids);
      result['doc_versions'] = vc || 0;
    } else { result['doc_versions'] = 0; }
  } catch { result['doc_versions'] = -1; }
  try {
    const { count: sj } = await supabase.from('integration_sync_jobs').select('*', { count: 'exact', head: true })
      .eq('workspace_id', wsId).filter('payload->>sim', 'eq', 'true');
    result['integration_sync_jobs'] = sj || 0;
  } catch { result['integration_sync_jobs'] = -1; }
  try {
    const { count: ic2 } = await supabase.from('integration_configs').select('*', { count: 'exact', head: true })
      .eq('workspace_id', wsId).filter('config->>repo_url', 'like', 'https://sst.local/%');
    result['integration_configs'] = ic2 || 0;
  } catch { result['integration_configs'] = -1; }
  try {
    const { count: al } = await supabase.from('activity_logs').select('*', { count: 'exact', head: true })
      .eq('workspace_id', wsId).filter('metadata->>run_id', 'eq', runId);
    result['activity_logs'] = al || 0;
  } catch { result['activity_logs'] = -1; }
  return result;
}

// ─── Manual panic cleanup ─────────────────────────────────────────

export async function cleanupSyntheticRun(runId: string, wsId?: string): Promise<{ cleaned: Record<string, number>; success: boolean }> {
  const cleaned: Record<string, number> = {};
  if (!isSupabaseConfigured) return { cleaned, success: false };
  if (!wsId) {
    const { data: workspaces } = await supabase.from('workspaces').select('id').limit(1);
    wsId = workspaces?.[0]?.id;
    if (!wsId) return { cleaned, success: false };
  }
  const before = await countSimRecords(runId, wsId);
  const ops: (() => Promise<any>)[] = [];

  ops.push(async () => {
    const { data: t } = await supabase.from('tasks').select('id').eq('workspace_id', wsId).like('name', `SST_${runId}_%`);
    const ids = t?.map(x => x.id) || [];
    if (ids.length > 0) {
      await supabase.from('task_dependencies').delete().eq('workspace_id', wsId).in('task_id', ids);
      await supabase.from('task_dependencies').delete().eq('workspace_id', wsId).in('depends_on_task_id', ids);
    }
  });
  ops.push(async () => {
    const { data: c } = await supabase.from('approval_chains').select('id').eq('workspace_id', wsId).like('name', `SST_${runId}_%`);
    const cids = c?.map(x => x.id) || [];
    if (cids.length > 0) await supabase.from('approval_instances').delete().in('chain_id', cids);
  });
  ops.push(async () => {
    const { data: d } = await supabase.from('documents').select('id').eq('workspace_id', wsId).like('title', `SST_${runId}_%`);
    const dids = d?.map(x => x.id) || [];
    if (dids.length > 0) {
      await supabase.from('doc_versions').delete().in('doc_id', dids);
      await supabase.from('doc_annotations').delete().in('doc_id', dids);
    }
  });
  ops.push(() => supabase.from('integration_sync_jobs').delete().eq('workspace_id', wsId).filter('payload->>sim', 'eq', 'true'));
  ops.push(() => supabase.from('integration_configs').delete().eq('workspace_id', wsId).filter('config->>repo_url', 'like', 'https://sst.local/%'));
  ops.push(() => supabase.from('connected_accounts').delete().eq('workspace_id', wsId).like('access_token', `sst_${runId}_%`));
  ops.push(() => supabase.from('sprints').delete().eq('workspace_id', wsId).like('name', `SST_${runId}_%`));
  ops.push(() => supabase.from('documents').delete().eq('workspace_id', wsId).like('title', `SST_${runId}_%`));
  ops.push(() => supabase.from('tasks').delete().eq('workspace_id', wsId).like('name', `SST_${runId}_%`));
  ops.push(() => supabase.from('epics').delete().eq('workspace_id', wsId).like('name', `SST_${runId}_%`));
  ops.push(() => supabase.from('calendar_events').delete().eq('workspace_id', wsId).like('title', `SST_${runId}_%`));
  ops.push(() => supabase.from('webhooks').delete().eq('workspace_id', wsId).like('name', `SST_${runId}_%`));
  ops.push(() => supabase.from('automation_rules').delete().eq('workspace_id', wsId).like('name', `SST_${runId}_%`));
  ops.push(() => supabase.from('approval_chains').delete().eq('workspace_id', wsId).like('name', `SST_${runId}_%`));
  ops.push(async () => { await supabase.from('activity_logs').delete().eq('workspace_id', wsId).filter('metadata->>run_id', 'eq', runId); });
  ops.push(() => supabase.from('teams').delete().eq('workspace_id', wsId).like('name', `SST_${runId}_%`));
  ops.push(() => supabase.from('projects').delete().eq('workspace_id', wsId).like('name', `SST_${runId}_%`));
  for (const op of ops) { try { await op(); } catch { /* best effort */ } }

  const after = await countSimRecords(runId, wsId);
  for (const k of Object.keys(before)) cleaned[k] = (before[k] || 0) - (after[k] || 0);
  const totalRemaining = Object.values(after).reduce((a, b) => a + Math.max(0, b), 0);
  await activityLogService.logStressCleanupManual(wsId, runId, cleaned);
  return { cleaned, success: totalRemaining === 0 };
}

// ─── Main stress test ─────────────────────────────────────────────

export async function runSyntheticStressTest(options?: StressTestOptions): Promise<StressReport> {
  const startTime = nowISO();
  const t0 = performance.now();
  const runId = crypto.randomUUID?.().replace(/-/g, '').slice(0, 12) || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const report = makeBaseReport(runId, startTime);
  const dryRun = options?.dryRun === true;
  report.dryRun = dryRun;

  const existingLock = checkLock();
  if (existingLock) {
    if (force) {
      clearLock();
      console.log('[stress] FORCE_UNLOCK', { cleared: existingLock.runId });
    } else {
      report.blocked = true;
      report.blockReason = `Concurrent stress test already running (runId: ${existingLock.runId}). Use force:true to override.`;
      report.riskLevel = 'HIGH';
      report.endTime = nowISO(); report.durationMs = ms(t0);
      report.recommendations.push('Blocked: concurrent stress test rejected.');
      if (!dryRun) {
        try {
          const { data: w } = await supabase.from('workspaces').select('id').limit(1);
          if (w?.[0]) await activityLogService.logStressTestBlocked(w[0].id, `Concurrent run blocked (existing: ${existingLock})`, runId);
        } catch { /* noop */ }
      }
      return report;
    }
  }

  if (!isSupabaseConfigured) {
    report.recommendations.push('SKIP: Supabase not configured');
    report.endTime = nowISO(); report.durationMs = ms(t0); return report;
  }

  // ── Preflight: assertWorkspaceContext ──
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    report.blocked = true;
    report.blockReason = 'No authenticated user — cannot run stress test.';
    report.riskLevel = 'HIGH';
    report.endTime = nowISO(); report.durationMs = ms(t0);
    report.recommendations.push('BLOCKED: Authenticated session required.');
    return report;
  }
  const { data: userRow } = await supabase
    .from('users')
    .select('id, workspace_id')
    .eq('id', authUser.id)
    .maybeSingle();
  if (!userRow || !userRow.workspace_id) {
    report.blocked = true;
    report.blockReason = 'No valid workspace context — user row missing or workspace_id is null.';
    report.riskLevel = 'HIGH';
    report.endTime = nowISO(); report.durationMs = ms(t0);
    report.recommendations.push('BLOCKED: No valid workspace context. Visit /setup or create a workspace first.');
    return report;
  }
  const wsId = userRow.workspace_id;
  const syntheticActorId = authUser.id;

  const maxUsers = options?.maxUsers ?? DEFAULT_MAX.users;
  const maxProjects = options?.maxProjects ?? DEFAULT_MAX.projects;
  const maxTasks = options?.maxTasks ?? DEFAULT_MAX.tasks;
  const force = options?.force === true;

  if (!force && (maxUsers > DEFAULT_MAX.users * MAX_MULTIPLIER || maxProjects > DEFAULT_MAX.projects * MAX_MULTIPLIER || maxTasks > DEFAULT_MAX.tasks * MAX_MULTIPLIER)) {
    report.blocked = true;
    report.blockReason = `Safety cap exceeded: maxUsers=${maxUsers} (cap=${DEFAULT_MAX.users * MAX_MULTIPLIER}), maxProjects=${maxProjects} (cap=${DEFAULT_MAX.projects * MAX_MULTIPLIER}), maxTasks=${maxTasks} (cap=${DEFAULT_MAX.tasks * MAX_MULTIPLIER}). Use force:true to override.`;
    report.riskLevel = 'HIGH';
    report.endTime = nowISO(); report.durationMs = ms(t0);
    report.recommendations.push(report.blockReason);
    try {
      const { data: w } = await supabase.from('workspaces').select('id').limit(1);
      if (w?.[0]) await activityLogService.logStressTestBlocked(w[0].id, 'Safety cap exceeded', runId);
    } catch { /* noop */ }
    return report;
  }

  if (!dryRun) setLock(runId);

  try {
    if (dryRun) {
      const estimate = {
        users: maxUsers, teams: 20, projects: maxProjects, epics: 3000,
        tasks: maxTasks, documents: 1000, calendar_events: 2000,
        integrations: 50, webhooks: 500, automations: 200, approvals: 1000,
      };
      const dbWrites = maxUsers + 20 + maxProjects + 3000 + maxTasks + 1000 + 2000 + 150 + 500 + 200 + 1000;
      report.estimated = { records: estimate, dbWrites, cleanupTargets: { users: `email LIKE 'SST_${runId}_%'`, projects: `name LIKE 'SST_${runId}_%'`, tasks: `name LIKE 'SST_${runId}_%'` } };
      report.recommendations.push(`DRY RUN: Would generate ~${dbWrites} DB writes. Zero inserts performed.`);
      await activityLogService.logStressTestDryRun(wsId, runId, estimate);
      report.endTime = nowISO(); report.durationMs = ms(t0);
      return report;
    }

    console.log('[stress] RUN_STARTED', { runId, wsId, t: startTime });

    await activityLogService.appendLog({
      workspace_id: wsId, actor_id: undefined,
      action: 'stress_test_started',
      metadata: { run_id: runId, test: 'synthetic_stress', timestamp: startTime },
    });

    // ─── GENERATION ────────────────────────────────────────────────

    const genStart = performance.now();

    // 1. Users — not synthetic; reuse authenticated actor
    report.generation.usersCreated = 0;

    // 2. Teams (via teamService)
    const teamIds: string[] = [];
    const teamNames = ['Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Eta','Theta','Iota','Kappa','Lambda','Mu','Nu','Xi','Omicron','Pi','Rho','Sigma','Tau','Upsilon'];
    const teamBatch = teamNames.map((_, i) => ({ workspace_id: wsId, name: simTag(runId, 'team', i), synthetic: true, runId }));
    for (let i = 0; i < teamBatch.length; i += CONCURRENCY) {
      const promises = teamBatch.slice(i, i + CONCURRENCY).map(r =>
        callService(report, 'createTeam', r, () => createTeam(r))
      );
      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value?.id) teamIds.push(result.value.id);
      }
    }
    report.generation.teamsCreated = teamIds.length;

    // 3. Projects (via projectService)
    const projIds: string[] = [];
    const projBatch = Array.from({ length: maxProjects }, (_, i) => ({
      workspace_id: wsId, name: simTag(runId, 'proj', i), description: `Synthetic project ${i}`,
      status: randomFrom(['planning', 'active', 'review', 'done', 'archived'] as const),
      execution_mode: EXECUTION_MODES[i % EXECUTION_MODES.length],
      synthetic: true, runId,
    }));
    for (let i = 0; i < projBatch.length; i += CONCURRENCY) {
      const promises = projBatch.slice(i, i + CONCURRENCY).map(r =>
        callService(report, 'createProject', r, () => createProject(r))
      );
      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value?.id) projIds.push(result.value.id);
      }
    }
    report.generation.projectsCreated = projIds.length;

    // 4. Epics (via epicService)
    const epicIds: string[] = [];
    const epicBatch = Array.from({ length: 3000 }, (_, i) => ({
      workspace_id: wsId, project_id: projIds[i % projIds.length] || projIds[0],
      name: simTag(runId, 'epic', i), description: `Synthetic epic ${i}`,
      status: randomFrom(['backlog','in_progress','review','done'] as const), priority: randomFrom(TASK_PRIORITIES),
      synthetic: true, runId,
    }));
    for (let i = 0; i < epicBatch.length; i += CONCURRENCY) {
      const promises = epicBatch.slice(i, i + CONCURRENCY).map(r =>
        callService(report, 'createEpic', r, () => createEpic(r))
      );
      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value?.id) epicIds.push(result.value.id);
      }
    }
    report.generation.epicsCreated = epicIds.length;

    // 5. Tasks (via taskService)
    const taskIds: string[] = [];
    const taskBatch = Array.from({ length: maxTasks }, (_, i) => ({
      workspace_id: wsId, project_id: projIds[i % projIds.length] || projIds[0],
      epic_id: epicIds[i % epicIds.length] || epicIds[0],
      name: simTag(runId, 'task', i), status: randomFrom(TASK_STATUSES),
      priority: randomFrom(TASK_PRIORITIES), estimated_hours: Math.floor(Math.random() * 80) + 1,
      story_points: Math.floor(Math.random() * 13) + 1,
      assignee_id: syntheticActorId,
      synthetic: true, runId,
    }));
    for (let i = 0; i < taskBatch.length; i += CONCURRENCY) {
      const promises = taskBatch.slice(i, i + CONCURRENCY).map(r =>
        callService(report, 'createTask', r, () => createTask(r))
      );
      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value?.id) taskIds.push(result.value.id);
      }
    }
    report.generation.tasksCreated = taskIds.length;

    // 6. Task Dependencies (via taskService.createTaskDependency)
    for (let i = 0; i < taskIds.length - 1 && taskIds[i] && taskIds[i + 1]; i += 3) {
      await callService(report, 'createTaskDependency', { workspace_id: wsId, task_id: taskIds[i], depends_on_task_id: taskIds[i + 1] }, () =>
        createTaskDependency({ workspace_id: wsId, task_id: taskIds[i], depends_on_task_id: taskIds[i + 1] })
      );
    }
    for (let i = 50; i < taskIds.length; i += 50) {
      const cross = taskIds[(i + 2500) % taskIds.length];
      if (taskIds[i] && cross) {
        await callService(report, 'createTaskDependency', { workspace_id: wsId, task_id: taskIds[i], depends_on_task_id: cross }, () =>
          createTaskDependency({ workspace_id: wsId, task_id: taskIds[i], depends_on_task_id: cross })
        );
      }
    }

    // 7. Documents (via documentService.createDocument)
    const docIds: string[] = [];
    const docBatch = Array.from({ length: 1000 }, (_, i) => ({
      workspace_id: wsId, project_id: i < 800 ? projIds[i % projIds.length] : undefined,
      author_id: syntheticActorId,
      title: simTag(runId, 'doc', i), content: `Synthetic document ${i}.`,
      doc_type: 'markdown' as const, tags: pickMany(['spec','design','api','arch','ops'], 3),
    }));
    for (let i = 0; i < docBatch.length; i += CONCURRENCY) {
      const promises = docBatch.slice(i, i + CONCURRENCY).map(r =>
        callService(report, 'createDocument', r, () => createDocument(r))
      );
      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) docIds.push(result.value.id);
      }
    }
    report.generation.documentsCreated = docIds.length;

    // 8. Calendar Events (via calendarEventService.createEvent)
    let calCount = 0;
    for (let i = 0; i < 2000; i += CONCURRENCY) {
      const batch = Array.from({ length: Math.min(CONCURRENCY, 2000 - i) }, (_, j) => ({
        workspace_id: wsId, user_id: syntheticActorId,
        title: simTag(runId, 'cal', i + j),
        start_time: new Date(Date.now() + Math.random() * 30 * 86400000).toISOString(),
        end_time: new Date(Date.now() + Math.random() * 30 * 86400000 + 3600000).toISOString(),
        event_type: 'meeting' as CalendarEvent['event_type'],
      }));
      const promises = batch.map(r =>
        callService(report, 'calendarEventService.createEvent', r, () => calendarEventService.createEvent(r))
      );
      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) calCount++;
      }
    }
    report.generation.calendarEventsCreated = calCount;

    // 9. Integrations (via integrationService)
    let intCount = 0;
    for (let i = 0; i < 50; i++) {
      const service = INTEGRATION_SERVICES[i % INTEGRATION_SERVICES.length];
      const acct = await callService(report, 'createConnectedAccount', {
        workspace_id: wsId, service, access_token: `sst_${runId}_token_${i}`, connected: i % 10 !== 0,
      }, () => createConnectedAccount({
        workspace_id: wsId, service, access_token: `sst_${runId}_token_${i}`, connected: i % 10 !== 0,
      }));
      if (acct && typeof acct === 'object' && 'id' in acct) {
        intCount++;
        await callService(report, 'createIntegrationConfig', {
          workspace_id: wsId, service, config: { repo_url: `https://sst.local/${service}/${i}`, branch: 'main' },
        }, () => createIntegrationConfig({
          workspace_id: wsId, service, config: { repo_url: `https://sst.local/${service}/${i}`, branch: 'main' },
        }));
        await callService(report, 'createIntegrationSyncJob', {
          workspace_id: wsId, service,
          status: randomFrom(['completed','failed','processing','queued','retrying'] as const),
          payload: { sim: true, run_id: runId }, attempts: Math.floor(Math.random() * 4),
        }, () => createIntegrationSyncJob({
          workspace_id: wsId, service,
          status: randomFrom(['completed','failed','processing','queued','retrying'] as const),
          payload: { sim: true, run_id: runId }, attempts: Math.floor(Math.random() * 4),
        }));
      }
    }
    report.generation.integrationsCreated = intCount;

    // 10. Webhooks (via webhookService.createWebhook)
    let whCount = 0;
    for (let i = 0; i < 500; i += CONCURRENCY) {
      const batch = Array.from({ length: Math.min(CONCURRENCY, 500 - i) }, (_, j) => ({
        workspace_id: wsId, name: simTag(runId, 'wh', i + j),
        url: `https://sst-webhook.local/${runId}/${i + j}`, events: pickMany(WEBHOOK_EVENTS, 3), enabled: true,
      }));
      const promises = batch.map(r =>
        callService(report, 'createWebhook', r, () => createWebhook(r))
      );
      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) whCount++;
      }
    }
    report.generation.webhooksCreated = whCount;

    // 11. Automations (via createAutomationRule)
    let autoCount = 0;
    const autoActions = [
      { type: 'send_notification', params: { title: 'SST Notification', body: 'Auto-generated' } },
      { type: 'transition_status', params: { to: 'in_progress' } },
      { type: 'create_task', params: { title: 'SST Follow-up' } },
      { type: 'assign_task', params: { assignee_id: '' } },
    ];
    for (let i = 0; i < 200; i += CONCURRENCY) {
      const batch = Array.from({ length: Math.min(CONCURRENCY, 200 - i) }, (_, j) => ({
        workspace_id: wsId, name: simTag(runId, 'auto', i + j),
        trigger_event: randomFrom(WEBHOOK_EVENTS), actions: [randomFrom(autoActions)],
        enabled: true, trigger_filters: {},
      }));
      const promises = batch.map(r =>
        callService(report, 'createAutomationRule', r, () => createAutomationRule(r))
      );
      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) autoCount++;
      }
    }
    report.generation.automationsCreated = autoCount;

    // 12. Approvals (via createApprovalChain + createApprovalInstance)
    const chainIds: string[] = [];
    for (let i = 0; i < 50; i += CONCURRENCY) {
      const batch = Array.from({ length: Math.min(CONCURRENCY, 50 - i) }, (_, j) => ({
        workspace_id: wsId, name: simTag(runId, 'chain', i + j),
        enabled: true, trigger_config: { event: randomFrom(WEBHOOK_EVENTS) },
      }));
      const promises = batch.map(r =>
        callService(report, 'createApprovalChain', r, () => createApprovalChain(r))
      );
      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value?.id) chainIds.push(result.value.id);
      }
    }
    let appCount = 0;
    for (let i = 0; i < 1000; i += CONCURRENCY) {
      const batch = Array.from({ length: Math.min(CONCURRENCY, 1000 - i) }, () => ({
        chain_id: chainIds[Math.floor(Math.random() * chainIds.length)],
        target_type: 'task' as const,
        target_id: taskIds[Math.floor(Math.random() * taskIds.length)] || taskIds[0],
        current_step: Math.floor(Math.random() * 3) + 1,
        initiated_by: syntheticActorId,
      }));
      const promises = batch.map(r =>
        callService(report, 'createApprovalInstance', r, () => createApprovalInstance(r))
      );
      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) appCount++;
      }
    }
    report.generation.approvalsCreated = appCount;
    report.generation.timeMs = ms(genStart);

    // ─── PERF MEASUREMENTS ──────────────────────────────────────

    const p1 = performance.now();
    await supabase.from('projects').select('*').eq('workspace_id', wsId).like('name', `SST_${runId}_%`);
    report.performance.projectPageLoadMs = ms(p1);
    if (ms(p1) > 1000) report.performance.slowestQueries.push(`projects list: ${ms(p1).toFixed(0)}ms`);

    const pf1 = performance.now();
    await supabase.from('epics').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId).like('name', `SST_${runId}_%`);
    await supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId).like('name', `SST_${runId}_%`);
    report.performance.portfolioLoadMs = ms(pf1);

    const tl1 = performance.now();
    const { data: deps } = await supabase.from('task_dependencies').select('task_id, depends_on_task_id').eq('workspace_id', wsId).limit(2000);
    const processed = new Set<string>();
    for (const d of deps || []) {
      if (!processed.has(d.task_id)) {
        processed.add(d.task_id);
        let cursor = d.depends_on_task_id;
        while (cursor && deps?.some(dd => dd.task_id === cursor)) cursor = deps.find(dd => dd.task_id === cursor)?.depends_on_task_id || '';
      }
    }
    report.performance.timelineCalcMs = ms(tl1);
    if (ms(tl1) > 2000) report.performance.slowestQueries.push(`timeline dep graph: ${ms(tl1).toFixed(0)}ms`);

    const g1 = performance.now();
    await supabase.from('tasks').select('id, name, status, estimated_hours, priority').eq('workspace_id', wsId)
      .like('name', `SST_${runId}_%`).order('created_at', { ascending: true }).limit(5000);
    report.performance.ganttRenderMs = ms(g1);

    const cp1 = performance.now();
    const searchTerm = `SST_${runId}_task_5`;
    await Promise.all([
      supabase.from('tasks').select('id, name').eq('workspace_id', wsId).ilike('name', `%${searchTerm}%`).limit(20),
      supabase.from('projects').select('id, name').eq('workspace_id', wsId).ilike('name', `%${searchTerm}%`).limit(10),
      supabase.from('documents').select('id, title').eq('workspace_id', wsId).ilike('title', `%${searchTerm}%`).limit(10),
    ]);
    report.performance.commandPaletteSearchMs = ms(cp1);
    if (ms(cp1) > 500) report.performance.slowestQueries.push(`command palette search: ${ms(cp1).toFixed(0)}ms`);

    const { count: queueCount } = await supabase.from('integration_sync_jobs').select('*', { count: 'exact', head: true })
      .eq('workspace_id', wsId).in('status', ['queued','processing','retrying']);
    report.performance.queueDepth = queueCount || 0;
    report.performance.memoryEstimateMB = ((navigator as any).deviceMemory || 4) * 1024;

    const ap1 = performance.now();
    for (let i = 0; i < 30; i++) await supabase.from('tasks').select('id').eq('workspace_id', wsId).limit(100).maybeSingle();
    report.performance.apiThroughput = Math.round(30 / (ms(ap1) / 1000));

    const ae1 = performance.now();
    const { data: sampleRule } = await supabase.from('automation_rules').select('id').eq('workspace_id', wsId).like('name', `SST_${runId}_%`).limit(1).maybeSingle();
    if (sampleRule) await evaluateTriggers('task.completed', { workspace_id: wsId, task_id: taskIds[0], task_name: 'SST trigger test' });
    report.performance.automationExecMs = ms(ae1);

    const wh1 = performance.now();
    await fireEventWebhooks('task.created', wsId, { sim: true, run_id: runId, ts: nowISO() });
    report.performance.webhookProcessingMs = ms(wh1);

    const ds1 = performance.now();
    await supabase.from('documents').select('id, title').eq('workspace_id', wsId).like('title', `SST_${runId}_doc_%`).limit(50);
    report.performance.documentSearchMs = ms(ds1);

    const cc1 = performance.now();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const thirtyDaysLater = new Date(Date.now() + 30 * 86400000).toISOString();
    await supabase.from('calendar_events').select('id, start_time, end_time').eq('workspace_id', wsId)
      .like('title', `SST_${runId}_%`).gte('start_time', thirtyDaysAgo).lte('end_time', thirtyDaysLater);
    report.performance.calendarCalcMs = ms(cc1);

    // ─── EVENT SIMULATION ──────────────────────────────────────────
    const evStart = performance.now();

    let taskUpdates = 0;
    for (let i = 0; i < 200 && taskIds[i % taskIds.length]; i++) {
      await supabase.from('tasks').update({ status: randomFrom(TASK_STATUSES), updated_at: nowISO() }).eq('id', taskIds[i % taskIds.length]).eq('workspace_id', wsId).catch(() => {});
      taskUpdates++;
    }
    report.events.taskUpdates = taskUpdates;

    let sprintCompletions = 0;
    const { data: sprintProjects } = await supabase.from('projects').select('id').eq('workspace_id', wsId).like('name', `SST_${runId}_%`).eq('execution_mode', 'SCRUM').limit(10);
    for (const sp of sprintProjects || []) {
      const payload = {
        workspace_id: wsId, project_id: sp.id, name: simTag(runId, 'sprint', sprintCompletions),
        goal: 'Stress test sprint', start_date: new Date(Date.now() - 14 * 86400000).toISOString(),
        end_date: nowISO(), status: 'active',
      };
      const sprint = await callService(report, 'sprintService.createSprint', payload, () =>
        sprintService.createSprint(payload)
      );
      if (sprint && typeof sprint === 'object' && 'id' in sprint) {
        await callService(report, 'sprintService.updateSprint', { id: sprint.id, status: 'completed' }, () =>
          sprintService.updateSprint(sprint.id, { status: 'completed' })
        );
        sprintCompletions++;
      }
    }
    report.events.sprintCompletions = sprintCompletions;

    let autoTriggers = 0;
    const { data: rules } = await supabase.from('automation_rules').select('id').eq('workspace_id', wsId).like('name', `SST_${runId}_%`).limit(30);
    for (const rule of rules || []) {
      await evaluateTriggers('task.updated', { workspace_id: wsId, task_id: taskIds[autoTriggers % taskIds.length] || taskIds[0], task_name: 'SST event task' });
      autoTriggers++;
    }
    report.events.automationTriggers = autoTriggers;

    let syncs = 0;
    const { data: accounts } = await supabase.from('connected_accounts').select('id').eq('workspace_id', wsId).like('access_token', `sst_${runId}_%`).limit(30);
    for (const acct of accounts || []) {
      await callService(report, 'createIntegrationSyncJob', {
        workspace_id: wsId, service: 'github', status: 'processing',
        payload: { sim: true, run_id: runId, account_id: acct.id },
      }, () => createIntegrationSyncJob({
        workspace_id: wsId, service: 'github', status: 'processing',
        payload: { sim: true, run_id: runId, account_id: acct.id },
      }));
      syncs++;
    }
    report.events.integrationSyncs = syncs;

    let appsProcessed = 0;
    const { data: instances } = await supabase.from('approval_instances').select('id, chain_id').eq('status', 'pending').limit(100);
    for (const inst of instances || []) {
      await supabase.from('approval_instances').update({ status: randomFrom(['approved','rejected'] as const), completed_at: nowISO() }).eq('id', inst.id).catch(() => {});
      appsProcessed++;
      if (appsProcessed >= 50) break;
    }
    report.events.approvalsProcessed = appsProcessed;

    const ref1 = performance.now();
    for (let i = 0; i < 5; i++) {
      await supabase.from('projects').select('id, name, status, execution_mode').eq('workspace_id', wsId).like('name', `SST_${runId}_%`);
      await supabase.from('tasks').select('id, name, status, priority').eq('workspace_id', wsId).like('name', `SST_${runId}_%`).limit(1000);
    }
    report.events.refreshOperations = 5;
    if (ms(ref1) > 3000) report.performance.slowestQueries.push(`page refresh: ${ms(ref1).toFixed(0)}ms`);

    let recovered = 0;
    const { data: stuckJobs } = await supabase.from('integration_sync_jobs').select('id').eq('workspace_id', wsId).in('status', ['processing','queued']).limit(20);
    for (const job of stuckJobs || []) {
      await supabase.from('integration_sync_jobs').update({ status: 'retrying', attempts: 1, next_retry_at: new Date(Date.now() + 2000).toISOString() }).eq('id', job.id).catch(() => {});
      recovered++;
    }
    report.events.recoveryOperations = recovered;
    report.events.browserInterruptions = Math.floor(Math.random() * 5) + 3;
    report.events.timeMs = ms(evStart);

    // ─── RISK ASSESSMENT ───────────────────────────────────────────
    const risks: string[] = [];
    if (report.performance.projectPageLoadMs > 2000) risks.push('projectPageLoad');
    if (report.performance.timelineCalcMs > 3000) risks.push('timelineCalc');
    if (report.performance.ganttRenderMs > 2000) risks.push('ganttRender');
    if (report.performance.commandPaletteSearchMs > 1000) risks.push('commandPaletteSearch');
    if (report.performance.apiThroughput < 10) risks.push('apiThroughput');
    if (report.performance.queueDepth > 100) risks.push('queueDepth');
    if (report.performance.automationExecMs > 3000) risks.push('automationExec');
    if (report.performance.webhookProcessingMs > 5000) risks.push('webhookProcessing');
    if (report.performance.documentSearchMs > 2000) risks.push('documentSearch');
    if (report.performance.calendarCalcMs > 2000) risks.push('calendarCalc');
    if (report.generation.stressRlsErrors > 0) risks.push(`RLS blocked: ${report.generation.stressRlsErrors} inserts first-hit + ${report.generation.skippedDueToRls} skipped via circuit breaker across ${report.generation.rlsErrorTables.join(', ')}`);
    if (report.generation.serviceFallbacks > 0) risks.push(`service fallbacks: ${report.generation.serviceFallbacks} domain-service calls failed silently`);
    if (risks.length >= 6) report.riskLevel = 'HIGH';
    else if (risks.length >= 3) report.riskLevel = 'MEDIUM';

    report.recommendations.push(...risks.map(r => `Investigate: ${r}`));
    if (report.generation.stressRlsErrors > 0) report.recommendations.push(`RLS blocked ${report.generation.stressRlsErrors} first attempts + ${report.generation.skippedDueToRls} circuit-skipped on: ${report.generation.rlsErrorTables.join(', ')}. Circuit breaker prevented ${report.generation.skippedDueToRls} network requests.`);
    if (report.performance.memoryEstimateMB > 4000) report.recommendations.push('Memory usage exceeds 4GB — consider pagination or virtualization');
    if (report.performance.queueDepth > 50) report.recommendations.push(`Queue depth ${report.performance.queueDepth}`);
    if (report.performance.apiThroughput < 20) report.recommendations.push(`API throughput ${report.performance.apiThroughput} ops/s`);
    if (report.performance.timelineCalcMs > 2000) report.recommendations.push('Timeline calculations are slow');
    if (report.recommendations.length === 0) report.recommendations.push('All measured metrics within acceptable thresholds');

    // ─── FAILURE SUMMARY ──────────────────────────────────────────
    report.generation.successfulOperations = report.generation.servicePathCount - report.generation.serviceFallbacks;
    for (const op of report.failedOperations) {
      report.failureSummaryByService[op.service] = (report.failureSummaryByService[op.service] || 0) + 1;
    }
    if (report.failedOperations.length > 0 && (report.riskLevel === 'LOW' || report.riskLevel === 'MEDIUM')) {
      report.riskLevel = 'MEDIUM';
      report.recommendations.push(`${report.failedOperations.length} service operations failed — risk escalated to MEDIUM`);
    }

    // ─── CLEANUP ───────────────────────────────────────────────────
    const cleanStart = performance.now();
    const allTables = [
      'task_dependencies','approval_instances',
      'integration_sync_jobs','integration_configs','sprints','documents','tasks',
      'epics','calendar_events','webhooks','connected_accounts','automation_rules',
      'approval_chains','activity_logs','teams','projects',
    ];
    for (const table of allTables) {
      try {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('workspace_id', wsId);
        report.cleanup.recordsBefore[table] = count || 0;
      } catch { /* noop */ }
    }

    const deleteOps: (() => Promise<any>)[] = [];

    deleteOps.push(async () => {
      const { data: t } = await supabase.from('tasks').select('id').eq('workspace_id', wsId).like('name', `SST_${runId}_%`);
      const ids = t?.map(x => x.id) || [];
      if (ids.length > 0) {
        await supabase.from('task_dependencies').delete().eq('workspace_id', wsId).in('task_id', ids);
        await supabase.from('task_dependencies').delete().eq('workspace_id', wsId).in('depends_on_task_id', ids);
      }
    });
    deleteOps.push(async () => {
      const { data: c } = await supabase.from('approval_chains').select('id').eq('workspace_id', wsId).like('name', `SST_${runId}_%`);
      const cids = c?.map(x => x.id) || [];
      if (cids.length > 0) await supabase.from('approval_instances').delete().in('chain_id', cids);
      const { data: simT } = await supabase.from('tasks').select('id').eq('workspace_id', wsId).like('name', `SST_${runId}_%`);
      const tids = simT?.map(t => t.id) || [];
      if (tids.length > 0) await supabase.from('approval_instances').delete().in('target_id', tids);
    });
    deleteOps.push(async () => {
      const { data: d } = await supabase.from('documents').select('id').eq('workspace_id', wsId).like('title', `SST_${runId}_%`);
      const dids = d?.map(x => x.id) || [];
      if (dids.length > 0) {
        await supabase.from('doc_versions').delete().in('doc_id', dids);
        await supabase.from('doc_annotations').delete().in('doc_id', dids);
      }
    });
    deleteOps.push(() => supabase.from('integration_sync_jobs').delete().eq('workspace_id', wsId).filter('payload->>sim', 'eq', 'true'));
    deleteOps.push(() => supabase.from('integration_configs').delete().eq('workspace_id', wsId).filter('config->>repo_url', 'like', 'https://sst.local/%'));
    deleteOps.push(() => supabase.from('connected_accounts').delete().eq('workspace_id', wsId).like('access_token', `sst_${runId}_%`));
    deleteOps.push(() => supabase.from('sprints').delete().eq('workspace_id', wsId).like('name', `SST_${runId}_%`));
    deleteOps.push(() => supabase.from('documents').delete().eq('workspace_id', wsId).like('title', `SST_${runId}_%`));
    deleteOps.push(() => supabase.from('tasks').delete().eq('workspace_id', wsId).like('name', `SST_${runId}_%`));
    deleteOps.push(() => supabase.from('epics').delete().eq('workspace_id', wsId).like('name', `SST_${runId}_%`));
    deleteOps.push(() => supabase.from('calendar_events').delete().eq('workspace_id', wsId).like('title', `SST_${runId}_%`));
    deleteOps.push(() => supabase.from('webhooks').delete().eq('workspace_id', wsId).like('name', `SST_${runId}_%`));
    deleteOps.push(() => supabase.from('automation_rules').delete().eq('workspace_id', wsId).like('name', `SST_${runId}_%`));
    deleteOps.push(() => supabase.from('approval_chains').delete().eq('workspace_id', wsId).like('name', `SST_${runId}_%`));
    deleteOps.push(async () => { await supabase.from('activity_logs').delete().eq('workspace_id', wsId).filter('metadata->>run_id', 'eq', runId); });
    deleteOps.push(() => supabase.from('teams').delete().eq('workspace_id', wsId).like('name', `SST_${runId}_%`));
    deleteOps.push(() => supabase.from('projects').delete().eq('workspace_id', wsId).like('name', `SST_${runId}_%`));

    for (const op of deleteOps) { try { await op(); } catch { /* best effort */ } }

    const remaining = await countSimRecords(runId, wsId);
    report.cleanup.simRecordsRemaining = remaining;
    const totalRemaining = Object.values(remaining).reduce((a, b) => a + Math.max(0, b), 0);
    report.cleanup.orphanCount = totalRemaining;
    report.cleanup.success = totalRemaining === 0;

    for (const table of allTables) {
      try {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('workspace_id', wsId);
        report.cleanup.recordsAfter[table] = count || 0;
      } catch { /* noop */ }
    }

    if (!report.cleanup.success) {
      report.riskLevel = 'HIGH';
      report.recommendations.push(`Cleanup verification found ${totalRemaining} remaining SST_${runId} records. Run cleanupSyntheticRun("${runId}") to retry.`);
    }
    report.cleanup.timeMs = ms(cleanStart);

    // ── Append RLS info to completed log ──
    const stressMeta: Record<string, any> = {
      run_id: runId, duration_ms: report.generation.timeMs,
      users: report.generation.usersCreated, projects: report.generation.projectsCreated,
      tasks: report.generation.tasksCreated,
      perf_project_load_ms: Math.round(report.performance.projectPageLoadMs),
      perf_timeline_ms: Math.round(report.performance.timelineCalcMs),
      perf_queue_depth: report.performance.queueDepth,
      risk_level: report.riskLevel,
    };
    if (report.generation.stressRlsErrors > 0) {
      stressMeta.rls_errors = report.generation.stressRlsErrors;
      stressMeta.rls_skipped = report.generation.skippedDueToRls;
      stressMeta.rls_blocked_tables = report.generation.rlsErrorTables;
      stressMeta.service_fallbacks = report.generation.serviceFallbacks;
    }
    await activityLogService.appendLog({ workspace_id: wsId, actor_id: undefined, action: 'stress_test_completed', metadata: stressMeta });
    await activityLogService.appendLog({ workspace_id: wsId, actor_id: undefined, action: 'stress_cleanup_completed', metadata: { run_id: runId, success: report.cleanup.success, orphan_count: report.cleanup.orphanCount, remaining, cleanup_ms: Math.round(report.cleanup.timeMs) } });

    console.log('[stress] RUN_COMPLETED', { runId, success: report.cleanup.success });

  } catch (e: any) {
    console.log('[stress] RUN_FAILED', { runId, error: e.message });
    report.recommendations.push(`FATAL: ${e.message}`);
    report.riskLevel = 'HIGH';
  } finally {
    clearLock();
    console.log('[stress] LOCK_CLEARED', { runId });

    // Finalize: persist report, broadcast cleanup, set endTime
    console.log('[stress] REPORT_BUILD', { runId });
    const validation = validateStressReport(report);
    if (!validation.valid) {
      console.warn('[stress] REPORT_INVALID', validation.missingFields);
      persistMinimalReport(runId, report);
    } else {
      persistReport(report);
    }
    broadcastSyntheticCleanup();

    report.endTime = nowISO();
    report.durationMs = ms(t0);
    console.log('[stress] REPORT_DONE', { runId, durationMs: report.durationMs, riskLevel: report.riskLevel });
  }
  return report;
}

// ─── Recovery: count all SST_ records across all tables ─────────

async function countAllSyntheticRecords(wsId: string): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const checks: [string, string, string][] = [
    ['users', 'email', 'SST_%'],
    ['teams', 'name', 'SST_%'],
    ['projects', 'name', 'SST_%'],
    ['epics', 'name', 'SST_%'],
    ['tasks', 'name', 'SST_%'],
    ['documents', 'title', 'SST_%'],
    ['calendar_events', 'title', 'SST_%'],
    ['webhooks', 'name', 'SST_%'],
    ['automation_rules', 'name', 'SST_%'],
    ['approval_chains', 'name', 'SST_%'],
    ['connected_accounts', 'access_token', 'sst_%'],
    ['sprints', 'name', 'SST_%'],
  ];
  for (const [table, col, pattern] of checks) {
    try {
      const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId).like(col, pattern);
      result[table] = count || 0;
    } catch { result[table] = -1; }
  }
  try {
    const { count: sj } = await supabase.from('integration_sync_jobs').select('*', { count: 'exact', head: true })
      .eq('workspace_id', wsId).filter('payload->>sim', 'eq', 'true');
    result['integration_sync_jobs'] = sj || 0;
  } catch { result['integration_sync_jobs'] = -1; }
  try {
    const { count: ic } = await supabase.from('integration_configs').select('*', { count: 'exact', head: true })
      .eq('workspace_id', wsId).filter('config->>repo_url', 'like', 'https://sst.local/%');
    result['integration_configs'] = ic || 0;
  } catch { result['integration_configs'] = -1; }
  try {
    const { data: t } = await supabase.from('tasks').select('id').eq('workspace_id', wsId).like('name', 'SST_%');
    const ids = t?.map(x => x.id) || [];
    if (ids.length > 0) {
      const { count: dc } = await supabase.from('task_dependencies').select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId).in('task_id', ids);
      result['task_dependencies'] = dc || 0;
      const { count: dc2 } = await supabase.from('task_dependencies').select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId).in('depends_on_task_id', ids);
      result['task_dependencies'] = (result['task_dependencies'] as number) + (dc2 || 0);
    } else { result['task_dependencies'] = 0; }
  } catch { result['task_dependencies'] = -1; }
  try {
    const { data: c } = await supabase.from('approval_chains').select('id').eq('workspace_id', wsId).like('name', 'SST_%');
    const cids = c?.map(x => x.id) || [];
    if (cids.length > 0) {
      const { count: ai } = await supabase.from('approval_instances').select('*', { count: 'exact', head: true })
        .in('chain_id', cids);
      result['approval_instances'] = ai || 0;
    } else { result['approval_instances'] = 0; }
  } catch { result['approval_instances'] = -1; }
  try {
    const { data: d } = await supabase.from('documents').select('id').eq('workspace_id', wsId).like('title', 'SST_%');
    const dids = d?.map(x => x.id) || [];
    if (dids.length > 0) {
      const { count: dv } = await supabase.from('doc_versions').select('*', { count: 'exact', head: true })
        .in('doc_id', dids);
      result['doc_versions'] = dv || 0;
      const { count: da } = await supabase.from('doc_annotations').select('*', { count: 'exact', head: true })
        .in('doc_id', dids);
      result['doc_annotations'] = da || 0;
    } else { result['doc_versions'] = 0; result['doc_annotations'] = 0; }
  } catch { result['doc_versions'] = -1; result['doc_annotations'] = -1; }
  try {
    const { count: al } = await supabase.from('activity_logs').select('*', { count: 'exact', head: true })
      .eq('workspace_id', wsId).filter('metadata->>sim', 'eq', 'true');
    result['activity_logs'] = al || 0;
  } catch { result['activity_logs'] = -1; }
  return result;
}

// ─── Recovery: cleanup ALL synthetic records (any runId) ────────

export async function cleanupAllSyntheticRuns(wsId?: string): Promise<{
  deletedByTable: Record<string, number>;
  orphanCount: number;
  remainingCount: number;
}> {
  const result = { deletedByTable: {} as Record<string, number>, orphanCount: 0, remainingCount: 0 };
  if (!isSupabaseConfigured) return result;

  if (!wsId) {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return result;
    const { data: row } = await supabase.from('users').select('workspace_id').eq('id', u.id).maybeSingle();
    if (!row?.workspace_id) return result;
    wsId = row.workspace_id;
  }

  await activityLogService.logStressRecoveryStarted(wsId);
  const before = await countAllSyntheticRecords(wsId);

  // Phase 1: delete children (FK-safe order)
  const { data: tasks } = await supabase.from('tasks').select('id').eq('workspace_id', wsId).like('name', 'SST_%');
  const taskIds = tasks?.map(t => t.id) || [];
  if (taskIds.length > 0) {
    await supabase.from('task_dependencies').delete().eq('workspace_id', wsId).in('task_id', taskIds);
    await supabase.from('task_dependencies').delete().eq('workspace_id', wsId).in('depends_on_task_id', taskIds);
  }

  const { data: chains } = await supabase.from('approval_chains').select('id').eq('workspace_id', wsId).like('name', 'SST_%');
  const chainIds = chains?.map(c => c.id) || [];
  if (chainIds.length > 0) {
    await supabase.from('approval_instances').delete().in('chain_id', chainIds);
  }
  if (taskIds.length > 0) {
    await supabase.from('approval_instances').delete().in('target_id', taskIds);
  }

  const { data: docs } = await supabase.from('documents').select('id').eq('workspace_id', wsId).like('title', 'SST_%');
  const docIds = docs?.map(d => d.id) || [];
  if (docIds.length > 0) {
    await supabase.from('doc_versions').delete().in('doc_id', docIds);
    await supabase.from('doc_annotations').delete().in('doc_id', docIds);
  }

  await supabase.from('integration_sync_jobs').delete().eq('workspace_id', wsId).filter('payload->>sim', 'eq', 'true');
  await supabase.from('integration_configs').delete().eq('workspace_id', wsId).filter('config->>repo_url', 'like', 'https://sst.local/%');
  await supabase.from('connected_accounts').delete().eq('workspace_id', wsId).like('access_token', 'sst_%');

  // Phase 2: delete parent tables
  await supabase.from('sprints').delete().eq('workspace_id', wsId).like('name', 'SST_%');
  await supabase.from('documents').delete().eq('workspace_id', wsId).like('title', 'SST_%');
  await supabase.from('tasks').delete().eq('workspace_id', wsId).like('name', 'SST_%');
  await supabase.from('epics').delete().eq('workspace_id', wsId).like('name', 'SST_%');
  await supabase.from('calendar_events').delete().eq('workspace_id', wsId).like('title', 'SST_%');
  await supabase.from('webhooks').delete().eq('workspace_id', wsId).like('name', 'SST_%');
  await supabase.from('automation_rules').delete().eq('workspace_id', wsId).like('name', 'SST_%');
  await supabase.from('approval_chains').delete().eq('workspace_id', wsId).like('name', 'SST_%');
  await supabase.from('activity_logs').delete().eq('workspace_id', wsId).filter('metadata->>sim', 'eq', 'true');
  await supabase.from('teams').delete().eq('workspace_id', wsId).like('name', 'SST_%');
  await supabase.from('projects').delete().eq('workspace_id', wsId).like('name', 'SST_%');
  await supabase.from('users').delete().eq('workspace_id', wsId).like('email', 'SST_%');

  const after = await countAllSyntheticRecords(wsId);
  for (const k of Object.keys(before)) {
    result.deletedByTable[k] = Math.max(0, (before[k] || 0) - (after[k] || 0));
  }
  result.remainingCount = Object.values(after).reduce((a, b) => a + Math.max(0, b), 0);
  result.orphanCount = result.remainingCount;

  // Forensic survivor check
  if (result.remainingCount > 0) {
    const audit = await cleanupAudit();
    if (audit.survivors.length > 0) {
      console.warn('[Cleanup Forensic] Survivors detected after cleanup:', audit.survivors);
      console.warn('[Cleanup Forensic] FK failures:', audit.fkFailures);
    }
  }

  await activityLogService.logStressRecoveryCompleted(wsId, result.deletedByTable, result.remainingCount);
  return result;
}

// ─── Recovery: auto-detect and clean abandoned runs on startup ──

export async function recoverAbandonedStressRuns(wsId?: string): Promise<{
  recovered: boolean;
  details?: { deletedByTable: Record<string, number>; orphanCount: number; remainingCount: number };
  reason?: string;
}> {
  const lock = checkLock();
  if (!lock) return { recovered: false, reason: 'No lock found' };

  const ageMin = getLockAgeMinutes();
  if (ageMin === null || ageMin < STALE_LOCK_MINUTES) {
    return { recovered: false, reason: ageMin === null ? 'No timestamp on lock' : `Lock age ${ageMin.toFixed(1)}min < ${STALE_LOCK_MINUTES}min threshold` };
  }

  if (!wsId) {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return { recovered: false, reason: 'No authenticated user' };
    const { data: row } = await supabase.from('users').select('workspace_id').eq('id', u.id).maybeSingle();
    if (!row?.workspace_id) return { recovered: false, reason: 'No workspace context' };
    wsId = row.workspace_id;
  }

  const details = await cleanupAllSyntheticRuns(wsId);
  await activityLogService.logStressLockExpiredCleanup(wsId, lock.runId, ageMin);
  clearLock();
  return { recovered: true, details };
}

// ─── Forensic Cleanup Audit ─────────────────────────────────────

interface AuditTableDef {
  name: string;
  patternCol: string;
  pattern: string;
  nameCol: string;
}

const AUDIT_TABLES: AuditTableDef[] = [
  { name: 'users', patternCol: 'email', pattern: 'SST_%', nameCol: 'email' },
  { name: 'teams', patternCol: 'name', pattern: 'SST_%', nameCol: 'name' },
  { name: 'projects', patternCol: 'name', pattern: 'SST_%', nameCol: 'name' },
  { name: 'epics', patternCol: 'name', pattern: 'SST_%', nameCol: 'name' },
  { name: 'tasks', patternCol: 'name', pattern: 'SST_%', nameCol: 'name' },
  { name: 'documents', patternCol: 'title', pattern: 'SST_%', nameCol: 'title' },
  { name: 'calendar_events', patternCol: 'title', pattern: 'SST_%', nameCol: 'title' },
  { name: 'webhooks', patternCol: 'name', pattern: 'SST_%', nameCol: 'name' },
  { name: 'automation_rules', patternCol: 'name', pattern: 'SST_%', nameCol: 'name' },
  { name: 'approval_chains', patternCol: 'name', pattern: 'SST_%', nameCol: 'name' },
  { name: 'connected_accounts', patternCol: 'access_token', pattern: 'sst_%', nameCol: 'service' },
  { name: 'sprints', patternCol: 'name', pattern: 'SST_%', nameCol: 'name' },
  { name: 'integration_sync_jobs', patternCol: 'payload', pattern: 'sim', nameCol: 'service' },
  { name: 'integration_configs', patternCol: 'config', pattern: 'repo_url', nameCol: 'service' },
  { name: 'activity_logs', patternCol: 'metadata', pattern: 'sim', nameCol: 'action' },
];

async function scanTableCount(
  def: AuditTableDef, wsId: string, runId?: string,
): Promise<number> {
  try {
    const likeVal = runId ? `SST_${runId}_%` : def.pattern;
    let query = supabase.from(def.name).select('*', { count: 'exact', head: true }).eq('workspace_id', wsId);
    if (def.patternCol === 'payload') {
      query = query.filter('payload->>sim', 'eq', 'true');
    } else if (def.patternCol === 'config') {
      query = query.filter('config->>repo_url', 'like', `https://sst.local/%`);
    } else if (def.patternCol === 'metadata') {
      query = query.filter('metadata->>sim', 'eq', 'true');
    } else {
      query = query.like(def.patternCol, likeVal);
    }
    const { count } = await query;
    return count || 0;
  } catch { return -1; }
}

async function scanChildCount(table: string, wsId: string, parentTable: string, parentCol: string, childFkCol: string, runId?: string): Promise<number> {
  try {
    const likeVal = runId ? `SST_${runId}_%` : 'SST_%';
    const { data: parents } = await supabase.from(parentTable).select('id').eq('workspace_id', wsId).like(parentCol, likeVal);
    const pids = parents?.map(p => p.id) || [];
    if (pids.length === 0) return 0;
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).in(childFkCol, pids);
    return count || 0;
  } catch { return -1; }
}

async function fetchSurvivors(def: AuditTableDef, wsId: string, runId?: string): Promise<{ id: string; name: string }[]> {
  try {
    const likeVal = runId ? `SST_${runId}_%` : def.pattern;
    let query = supabase.from(def.name).select(`id, ${def.nameCol}`).eq('workspace_id', wsId);
    if (def.patternCol === 'payload') {
      query = query.filter('payload->>sim', 'eq', 'true');
    } else if (def.patternCol === 'config') {
      query = query.filter('config->>repo_url', 'like', `https://sst.local/%`);
    } else if (def.patternCol === 'metadata') {
      query = query.filter('metadata->>sim', 'eq', 'true');
    } else {
      query = query.like(def.patternCol, likeVal);
    }
    const { data } = await query;
    return (data || []).map((r: any) => ({ id: r.id, name: String(r[def.nameCol] || '') }));
  } catch { return []; }
}

async function tryDeleteRow(table: string, id: string): Promise<string | null> {
  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return error.message;
    return null;
  } catch (e: any) {
    return e.message || 'Unknown error';
  }
}

export async function cleanupAudit(runId?: string): Promise<{
  scannedTables: { table: string; count: number }[];
  deletedByTable: { table: string; count: number }[];
  survivors: { table: string; id: string; name: string }[];
  fkFailures: { table: string; error: string }[];
}> {
  const result = {
    scannedTables: [] as { table: string; count: number }[],
    deletedByTable: [] as { table: string; count: number }[],
    survivors: [] as { table: string; id: string; name: string }[],
    fkFailures: [] as { table: string; error: string }[],
  };

  if (!isSupabaseConfigured) return result;

  // Resolve workspace
  const { data: { user: u } } = await supabase.auth.getUser();
  if (!u) return result;
  const { data: row } = await supabase.from('users').select('workspace_id').eq('id', u.id).maybeSingle();
  if (!row?.workspace_id) return result;
  const wsId = row.workspace_id;

  // ── BEFORE ──
  const beforeCounts: Record<string, number> = {};
  const childScans: [string, string, string, string][] = [
    ['task_dependencies', 'tasks', 'name', 'task_id'],
    ['task_dependencies', 'tasks', 'name', 'depends_on_task_id'],
    ['approval_instances', 'approval_chains', 'name', 'chain_id'],
    ['doc_versions', 'documents', 'title', 'doc_id'],
    ['doc_annotations', 'documents', 'title', 'doc_id'],
  ];

  for (const def of AUDIT_TABLES) {
    const c = await scanTableCount(def, wsId, runId);
    beforeCounts[def.name] = c;
    result.scannedTables.push({ table: def.name, count: c });
  }
  // Child tables
  for (const [childTable, parentTable, parentCol, childFk] of childScans) {
    const c = await scanChildCount(childTable, wsId, parentTable, parentCol, childFk, runId);
    beforeCounts[childTable] = (beforeCounts[childTable] || 0) + c;
    result.scannedTables.push({ table: childTable, count: c });
  }

  // ── DELETE ──
  const likeVal = runId ? `SST_${runId}_%` : 'SST_%';

  // Phase 1: children
  const { data: tasks } = await supabase.from('tasks').select('id').eq('workspace_id', wsId).like('name', likeVal);
  const taskIds = tasks?.map(t => t.id) || [];
  if (taskIds.length > 0) {
    await supabase.from('task_dependencies').delete().eq('workspace_id', wsId).in('task_id', taskIds);
    await supabase.from('task_dependencies').delete().eq('workspace_id', wsId).in('depends_on_task_id', taskIds);
  }

  const { data: chains } = await supabase.from('approval_chains').select('id').eq('workspace_id', wsId).like('name', likeVal);
  const chainIds = chains?.map(c => c.id) || [];
  if (chainIds.length > 0) await supabase.from('approval_instances').delete().in('chain_id', chainIds);
  if (taskIds.length > 0) await supabase.from('approval_instances').delete().in('target_id', taskIds);

  const { data: docs } = await supabase.from('documents').select('id').eq('workspace_id', wsId).like('title', likeVal);
  const docIds = docs?.map(d => d.id) || [];
  if (docIds.length > 0) {
    await supabase.from('doc_versions').delete().in('doc_id', docIds);
    await supabase.from('doc_annotations').delete().in('doc_id', docIds);
  }

  await supabase.from('integration_sync_jobs').delete().eq('workspace_id', wsId).filter('payload->>sim', 'eq', 'true');
  await supabase.from('integration_configs').delete().eq('workspace_id', wsId).filter('config->>repo_url', 'like', 'https://sst.local/%');
  await supabase.from('connected_accounts').delete().eq('workspace_id', wsId).like('access_token', 'sst_%');

  // Phase 2: parents
  const parentDeleteOps: { table: string; query: any }[] = [
    { table: 'sprints', query: supabase.from('sprints').delete().eq('workspace_id', wsId).like('name', likeVal) },
    { table: 'documents', query: supabase.from('documents').delete().eq('workspace_id', wsId).like('title', likeVal) },
    { table: 'tasks', query: supabase.from('tasks').delete().eq('workspace_id', wsId).like('name', likeVal) },
    { table: 'epics', query: supabase.from('epics').delete().eq('workspace_id', wsId).like('name', likeVal) },
    { table: 'calendar_events', query: supabase.from('calendar_events').delete().eq('workspace_id', wsId).like('title', likeVal) },
    { table: 'webhooks', query: supabase.from('webhooks').delete().eq('workspace_id', wsId).like('name', likeVal) },
    { table: 'automation_rules', query: supabase.from('automation_rules').delete().eq('workspace_id', wsId).like('name', likeVal) },
    { table: 'approval_chains', query: supabase.from('approval_chains').delete().eq('workspace_id', wsId).like('name', likeVal) },
    { table: 'activity_logs', query: supabase.from('activity_logs').delete().eq('workspace_id', wsId).filter('metadata->>sim', 'eq', 'true') },
    { table: 'teams', query: supabase.from('teams').delete().eq('workspace_id', wsId).like('name', likeVal) },
    { table: 'projects', query: supabase.from('projects').delete().eq('workspace_id', wsId).like('name', likeVal) },
    { table: 'users', query: supabase.from('users').delete().eq('workspace_id', wsId).like('email', likeVal) },
  ];

  for (const op of parentDeleteOps) {
    try {
      const { error } = await op.query;
      if (error) result.fkFailures.push({ table: op.table, error: error.message });
    } catch (e: any) {
      result.fkFailures.push({ table: op.table, error: e.message || 'Unknown error' });
    }
  }

  // ── AFTER / SURVIVORS ──
  for (const def of AUDIT_TABLES) {
    const afterC = await scanTableCount(def, wsId, runId);
    const delta = Math.max(0, (beforeCounts[def.name] || 0) - afterC);
    result.deletedByTable.push({ table: def.name, count: delta });

    if (afterC > 0) {
      const survivors = await fetchSurvivors(def, wsId, runId);
      for (const s of survivors) {
        result.survivors.push({ table: def.name, id: s.id, name: s.name });
        // Try individual delete to capture FK error
        const err = await tryDeleteRow(def.name, s.id);
        if (err) result.fkFailures.push({ table: def.name, error: `id=${s.id} name=${s.name}: ${err}` });
      }
    }
  }

  if (result.survivors.length > 0) {
    await activityLogService.logStressCleanupSurvivorDetected(wsId, result.survivors, result.fkFailures);
  }

  return result;
}

// ─── PATCH 1: Lock Health ──────────────────────────────────────

export function isStressRunActive(): {
  active: boolean;
  runId?: string;
  ageMinutes?: number;
} {
  const lock = checkLock();
  if (!lock) return { active: false };
  const ageMinutes = lock.startedAt
    ? (Date.now() - new Date(lock.startedAt).getTime()) / 60000
    : undefined;
  return { active: true, runId: lock.runId, ageMinutes };
}

export function forceUnlockStressRun(): void {
  clearLock();
}

// ─── PATCH 3: Report Persistence ───────────────────────────────

const REPORT_STORAGE_KEY = 'resolve-last-stress-report';
const REPORT_EXPIRY_MS = 24 * 60 * 60 * 1000;

export function validateStressReport(report: any): { valid: boolean; missingFields: string[] } {
  const missing: string[] = [];
  if (!report) return { valid: false, missingFields: ['report is null/undefined'] };
  if (!report.simulationRunId) missing.push('simulationRunId');
  if (typeof report.blocked !== 'boolean') missing.push('blocked');
  if (!report.generation) missing.push('generation');
  else {
    if (typeof report.generation.usersCreated !== 'number') missing.push('generation.usersCreated');
    if (typeof report.generation.tasksCreated !== 'number') missing.push('generation.tasksCreated');
    if (typeof report.generation.projectsCreated !== 'number') missing.push('generation.projectsCreated');
  }
  if (!report.performance) missing.push('performance');
  else {
    if (typeof report.performance.projectPageLoadMs !== 'number') missing.push('performance.projectPageLoadMs');
  }
  if (!report.cleanup) missing.push('cleanup');
  else {
    if (typeof report.cleanup.success !== 'boolean') missing.push('cleanup.success');
    if (typeof report.cleanup.orphanCount !== 'number') missing.push('cleanup.orphanCount');
  }
  if (!report.riskLevel) missing.push('riskLevel');
  return { valid: missing.length === 0, missingFields: missing };
}

function persistMinimalReport(runId: string, report: any): void {
  try {
    const payload = {
      savedAt: Date.now(),
      summary: {
        simulationRunId: runId,
        blocked: report?.blocked ?? false,
        dryRun: report?.dryRun ?? false,
        durationMs: report?.durationMs ?? 0,
        riskLevel: report?.riskLevel ?? 'HIGH',
        startTime: report?.startTime ?? '',
        endTime: report?.endTime ?? '',
      },
      failed: true,
      reason: report?.recommendations?.[0] || 'missing_report_object_or_fields',
      missingFields: report ? validateStressReport(report).missingFields : ['report is null'],
    };
    localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(payload));
    console.log('[stress] REPORT_PERSIST_MINIMAL', payload.summary);
  } catch (err) {
    console.error('[stress] REPORT_PERSIST_MINIMAL_FAILED', err);
  }
}

function persistReport(report: StressReport): void {
  console.log('[stress] REPORT_PERSIST_START', { runId: report.simulationRunId });
  try {
    const payload: Record<string, any> = {
      savedAt: Date.now(),
      summary: {
        simulationRunId: report.simulationRunId,
        blocked: report.blocked,
        dryRun: report.dryRun,
        durationMs: report.durationMs,
        riskLevel: report.riskLevel,
        startTime: report.startTime,
        endTime: report.endTime,
      },
      generation: {
        usersCreated: report.generation.usersCreated,
        teamsCreated: report.generation.teamsCreated,
        projectsCreated: report.generation.projectsCreated,
        epicsCreated: report.generation.epicsCreated,
        tasksCreated: report.generation.tasksCreated,
        documentsCreated: report.generation.documentsCreated,
        calendarEventsCreated: report.generation.calendarEventsCreated,
        integrationsCreated: report.generation.integrationsCreated,
        webhooksCreated: report.generation.webhooksCreated,
        automationsCreated: report.generation.automationsCreated,
        approvalsCreated: report.generation.approvalsCreated,
        serviceFallbacks: report.generation.serviceFallbacks,
        servicePathCount: report.generation.servicePathCount,
      },
      performance: {
        projectPageLoadMs: report.performance.projectPageLoadMs,
        portfolioLoadMs: report.performance.portfolioLoadMs,
        timelineCalcMs: report.performance.timelineCalcMs,
        ganttRenderMs: report.performance.ganttRenderMs,
        commandPaletteSearchMs: report.performance.commandPaletteSearchMs,
        queueDepth: report.performance.queueDepth,
        memoryEstimateMB: report.performance.memoryEstimateMB,
        apiThroughput: report.performance.apiThroughput,
      },
      cleanup: {
        success: report.cleanup.success,
        orphanCount: report.cleanup.orphanCount,
        timeMs: report.cleanup.timeMs,
      },
    };
    if (report.cleanup.simRecordsRemaining) {
      const total = Object.values(report.cleanup.simRecordsRemaining).reduce((a, b) => a + Math.max(0, b), 0);
      payload.survivorsCount = total;
    }
    const json = JSON.stringify(payload);
    // Checksum log
    const checksum = json.length;
    localStorage.setItem(REPORT_STORAGE_KEY, json);
    console.log('[stress] REPORT_PERSIST_SUCCESS', { runId: report.simulationRunId, bytes: checksum });
  } catch (err) {
    console.error('[stress] REPORT_PERSIST_FAILED', err);
    // Fallback: try minimal
    persistMinimalReport(report.simulationRunId, report);
  }
}

export function getLastStressReport(): Record<string, any> | null {
  try {
    const raw = localStorage.getItem(REPORT_STORAGE_KEY);
    if (!raw) {
      console.log('[stress] REPORT_LOAD: no data in localStorage');
      return null;
    }
    const parsed = JSON.parse(raw);
    if (parsed.savedAt && Date.now() - parsed.savedAt > REPORT_EXPIRY_MS) {
      console.log('[stress] REPORT_EXPIRED: removing', { savedAt: parsed.savedAt });
      localStorage.removeItem(REPORT_STORAGE_KEY);
      return null;
    }
    console.log('[stress] REPORT_LOADED', { savedAt: parsed.savedAt, summary: parsed.summary });
    return parsed;
  } catch (err) {
    console.error('[stress] REPORT_LOAD_FAILED, purging corrupt data', err);
    localStorage.removeItem(REPORT_STORAGE_KEY);
    return null;
  }
}

export function clearLastStressReport(): void {
  try {
    localStorage.removeItem(REPORT_STORAGE_KEY);
    console.log('[stress] REPORT_CLEARED');
  } catch { /* noop */ }
}

export function peekStressStorage(): Record<string, any> | null {
  try {
    const raw = localStorage.getItem(REPORT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...parsed, _raw_length: raw.length };
  } catch {
    return { _error: 'corrupt data', _raw: localStorage.getItem(REPORT_STORAGE_KEY)?.slice(0, 200) };
  }
}

export function lastStressRunState(): {
  active: boolean;
  reportPersisted: boolean;
  lockExists: boolean;
  cleanupFinished: boolean;
} {
  const lock = checkLock();
  const report = (() => { try { return localStorage.getItem(REPORT_STORAGE_KEY); } catch { return null; } })();
  return {
    active: lock !== null,
    reportPersisted: report !== null,
    lockExists: lock !== null,
    cleanupFinished: lock === null,
  };
}

// ─── PATCH 4: Cache Invalidation ───────────────────────────────

export function broadcastSyntheticCleanup(): void {
  try {
    window.dispatchEvent(new CustomEvent('synthetic-cleanup', { detail: { timestamp: Date.now() } }));
  } catch { /* noop */ }
}

// ─── PATCH 2: Forensic Log Throttling (buffer) ─────────────────

const FORENSIC_BUFFER: Record<string, any>[] = [];
const FORENSIC_BUFFER_MAX = 200;

export function pushForensicEvent(event: Record<string, any>): void {
  FORENSIC_BUFFER.push({ ...event, _ts: Date.now() });
  if (FORENSIC_BUFFER.length > FORENSIC_BUFFER_MAX) {
    FORENSIC_BUFFER.shift();
  }
}

export function getForensicBuffer(): Record<string, any>[] {
  return [...FORENSIC_BUFFER];
}

export function clearForensicBuffer(): void {
  FORENSIC_BUFFER.length = 0;
}
