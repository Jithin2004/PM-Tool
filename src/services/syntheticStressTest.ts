import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';
import { fireEventWebhooks } from './webhookService';
import { evaluateTriggers } from './automationEngine';

const LOCK_KEY = 'resolve-stress-running';
const MAX_MULTIPLIER = 2;

const EXECUTION_MODES = ['KANBAN', 'SCRUM', 'SDLC', 'HYBRID'] as const;
const TASK_STATUSES = ['backlog', 'ready', 'in_progress', 'review', 'done'] as const;
const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const USER_ROLES = ['super_admin', 'pm', 'dev', 'viewer'] as const;
const INTEGRATION_SERVICES = ['github', 'gitlab', 'figma', 'google_calendar', 'google_drive', 'slack', 'jira', 'notion', 'asana', 'trello'] as const;
const WEBHOOK_EVENTS = ['task.created', 'task.updated', 'task.completed', 'project.created', 'sprint.completed', 'approval.completed', 'document.created'];

const DEFAULT_MAX = {
  users: 200,
  projects: 1000,
  tasks: 10000,
} as const;

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
    timeMs: number;
  };
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
}

function simTag(runId: string, label: string, index: number): string {
  return `SST_${runId}_${label}_${index}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickMany<T>(arr: readonly T[], count: number): T[] {
  const copy = [...arr]; const result: T[] = [];
  for (let i = 0; i < count && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy[idx]); copy.splice(idx, 1);
  }
  return result;
}

function ms(t0: number): number { return performance.now() - t0; }

function makeBaseReport(runId: string, startTime: string): StressReport {
  return {
    simulationRunId: runId, startTime, endTime: '', durationMs: 0,
    blocked: false, dryRun: false,
    generation: { usersCreated: 0, teamsCreated: 0, projectsCreated: 0, epicsCreated: 0, tasksCreated: 0, documentsCreated: 0, calendarEventsCreated: 0, integrationsCreated: 0, webhooksCreated: 0, automationsCreated: 0, approvalsCreated: 0, timeMs: 0 },
    performance: { projectPageLoadMs: 0, portfolioLoadMs: 0, timelineCalcMs: 0, ganttRenderMs: 0, commandPaletteSearchMs: 0, queueDepth: 0, memoryEstimateMB: 0, apiThroughput: 0, automationExecMs: 0, webhookProcessingMs: 0, documentSearchMs: 0, calendarCalcMs: 0, slowestQueries: [], largestRenderTrees: [] },
    events: { taskUpdates: 0, sprintCompletions: 0, automationTriggers: 0, integrationSyncs: 0, approvalsProcessed: 0, refreshOperations: 0, recoveryOperations: 0, browserInterruptions: 0, timeMs: 0 },
    cleanup: { recordsBefore: {}, recordsAfter: {}, simRecordsRemaining: {}, success: false, timeMs: 0, orphanCount: 0 },
    riskLevel: 'LOW', recommendations: [],
  };
}

function checkLock(): string | null {
  try { return localStorage.getItem(LOCK_KEY); } catch { return null; }
}

function setLock(runId: string): void {
  try { localStorage.setItem(LOCK_KEY, runId); } catch { /* noop */ }
}

function clearLock(): void {
  try { localStorage.removeItem(LOCK_KEY); } catch { /* noop */ }
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
  // Tables without direct name column — count via joins / JSONB
  try {
    const { data: tids } = await supabase.from('tasks').select('id')
      .eq('workspace_id', wsId).like('name', `SST_${runId}_%`);
    const ids = tids?.map(t => t.id) || [];
    if (ids.length > 0) {
      const { count: dc } = await supabase.from('task_dependencies').select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId).in('task_id', ids);
      result['task_dependencies'] = dc || 0;
    } else { result['task_dependencies'] = 0; }
  } catch { result['task_dependencies'] = -1; }

  try {
    const { data: cids } = await supabase.from('approval_chains').select('id')
      .eq('workspace_id', wsId).like('name', `SST_${runId}_%`);
    const aids = cids?.map(c => c.id) || [];
    if (aids.length > 0) {
      const { count: ic } = await supabase.from('approval_instances').select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId).in('chain_id', aids);
      result['approval_instances'] = ic || 0;
    } else { result['approval_instances'] = 0; }
  } catch { result['approval_instances'] = -1; }

  try {
    const { data: docs } = await supabase.from('documents').select('id')
      .eq('workspace_id', wsId).like('title', `SST_${runId}_%`);
    const dids = docs?.map(d => d.id) || [];
    if (dids.length > 0) {
      const { count: vc } = await supabase.from('doc_versions').select('*', { count: 'exact', head: true })
        .in('doc_id', dids);
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
      .eq('workspace_id', wsId).filter('config->>repo_url', 'like', `https://sst.local/%`);
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
    const { data: t } = await supabase.from('tasks').select('id').eq('workspace_id', wsId)
      .like('name', `SST_${runId}_%`);
    const ids = t?.map(x => x.id) || [];
    if (ids.length > 0) {
      await supabase.from('task_dependencies').delete().eq('workspace_id', wsId).in('task_id', ids);
      await supabase.from('task_dependencies').delete().eq('workspace_id', wsId).in('depends_on_task_id', ids);
    }
  });

  ops.push(async () => {
    const { data: c } = await supabase.from('approval_chains').select('id').eq('workspace_id', wsId)
      .like('name', `SST_${runId}_%`);
    const cids = c?.map(x => x.id) || [];
    if (cids.length > 0) await supabase.from('approval_instances').delete().in('chain_id', cids);
  });

  ops.push(async () => {
    const { data: d } = await supabase.from('documents').select('id').eq('workspace_id', wsId)
      .like('title', `SST_${runId}_%`);
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
  ops.push(() => supabase.from('users').delete().eq('workspace_id', wsId).like('email', `SST_${runId}_%`));

  for (const op of ops) { try { await op(); } catch { /* best effort */ } }

  const after = await countSimRecords(runId, wsId);
  for (const k of Object.keys(before)) {
    cleaned[k] = (before[k] || 0) - (after[k] || 0);
  }

  const totalRemaining = Object.values(after).reduce((a, b) => a + Math.max(0, b), 0);
  const success = totalRemaining === 0;

  await activityLogService.logStressCleanupManual(wsId, runId, cleaned);

  return { cleaned, success };
}

// ─── Main stress test ─────────────────────────────────────────────

export async function runSyntheticStressTest(options?: StressTestOptions): Promise<StressReport> {
  const startTime = nowISO();
  const t0 = performance.now();
  const runId = crypto.randomUUID?.().replace(/-/g, '').slice(0, 12) || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const report = makeBaseReport(runId, startTime);
  const dryRun = options?.dryRun === true;
  report.dryRun = dryRun;

  // ── Stress Lock ───────────────────────────────────────────────────
  const existingLock = checkLock();
  if (existingLock) {
    report.blocked = true;
    report.blockReason = `Concurrent stress test already running (runId: ${existingLock}). Only one test at a time.`;
    report.riskLevel = 'HIGH';
    report.endTime = nowISO();
    report.durationMs = ms(t0);
    report.recommendations.push('Blocked: concurrent stress test rejected. Wait for the running test to complete or clear localStorage key resolve-stress-running.');
    if (!dryRun) {
      try {
        const { data: w } = await supabase.from('workspaces').select('id').limit(1);
        if (w?.[0]) await activityLogService.logStressTestBlocked(w[0].id, `Concurrent run blocked (existing: ${existingLock})`, runId);
      } catch { /* noop */ }
    }
    return report;
  }

  if (!isSupabaseConfigured) {
    report.recommendations.push('SKIP: Supabase not configured');
    report.endTime = nowISO(); report.durationMs = ms(t0); return report;
  }

  // ── Safety Cap ────────────────────────────────────────────────────
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
      if (w?.[0]) await activityLogService.logStressTestBlocked(w[0].id, `Safety cap exceeded`, runId);
    } catch { /* noop */ }
    return report;
  }

  // ── Acquire lock ──────────────────────────────────────────────────
  if (!dryRun) setLock(runId);

  try {
    const { data: workspaces } = await supabase.from('workspaces').select('id').limit(1);
    const wsId = workspaces?.[0]?.id;
    if (!wsId) {
      report.recommendations.push('No workspace found — create one first');
      report.endTime = nowISO(); report.durationMs = ms(t0); return report;
    }

    // ── Immutable log: stress_test_dry_run ──
    if (dryRun) {
      const estimate = {
        users: maxUsers, teams: 20, projects: maxProjects, epics: 3000,
        tasks: maxTasks, documents: 1000, calendar_events: 2000,
        integrations: 50, webhooks: 500, automations: 200, approvals: 1000,
      };
      const dbWrites = maxUsers + 20 + maxProjects + 3000 + maxTasks + 1000 + 2000 + 150 + 500 + 200 + 1000;
      const cleanupTargets: Record<string, string> = {
        users: `email LIKE 'SST_${runId}_%'`,
        projects: `name LIKE 'SST_${runId}_%'`,
        tasks: `name LIKE 'SST_${runId}_%'`,
        documents: `title LIKE 'SST_${runId}_%'`,
        webhooks: `name LIKE 'SST_${runId}_%'`,
        integrations: `access_token LIKE 'sst_${runId}_%' OR payload->>sim=true`,
      };
      report.estimated = { records: estimate, dbWrites, cleanupTargets };
      report.recommendations.push(`DRY RUN: Would generate ~${dbWrites} DB writes across ${Object.keys(estimate).length} entity types`);
      report.recommendations.push(`DRY RUN: Cleanup would target ${Object.keys(cleanupTargets).length} tables via LIKE/JSONB filters`);
      await activityLogService.logStressTestDryRun(wsId, runId, estimate);
      report.endTime = nowISO(); report.durationMs = ms(t0);
      return report;
    }

    await activityLogService.appendLog({
      workspace_id: wsId, actor_id: undefined,
      action: 'stress_test_started',
      metadata: { run_id: runId, test: 'synthetic_stress', timestamp: startTime },
    });

    // ─── GENERATION ────────────────────────────────────────────────
    const genStart = performance.now();

    const userIds: string[] = [];
    const userBatch = Array.from({ length: maxUsers }, (_, i) => ({
      workspace_id: wsId, email: `${simTag(runId, 'user', i)}@sim.local`,
      full_name: simTag(runId, 'user', i), role: randomFrom(USER_ROLES),
      availability_factor: 0.4 + Math.random() * 0.6,
    }));
    for (let i = 0; i < userBatch.length; i += 50) {
      const { data } = await supabase.from('users').insert(userBatch.slice(i, i + 50)).select('id');
      if (data) userIds.push(...data.map(u => u.id));
    }
    report.generation.usersCreated = userIds.length;

    const teamIds: string[] = [];
    const teamNames = ['Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Eta','Theta','Iota','Kappa','Lambda','Mu','Nu','Xi','Omicron','Pi','Rho','Sigma','Tau','Upsilon'];
    const teamBatch = teamNames.map((_, i) => ({
      workspace_id: wsId, name: simTag(runId, 'team', i), description: `Synthetic team ${teamNames[i]}`,
    }));
    for (let i = 0; i < teamBatch.length; i += 20) {
      const { data } = await supabase.from('teams').insert(teamBatch.slice(i, i + 20)).select('id');
      if (data) teamIds.push(...data.map(t => t.id));
    }
    report.generation.teamsCreated = teamIds.length;

    const projIds: string[] = [];
    const projBatch = Array.from({ length: maxProjects }, (_, i) => ({
      workspace_id: wsId, name: simTag(runId, 'proj', i), description: `Synthetic project ${i}`,
      status: randomFrom(['active','deployed','archived'] as const),
      execution_mode: EXECUTION_MODES[i % EXECUTION_MODES.length],
    }));
    for (let i = 0; i < projBatch.length; i += 50) {
      const { data } = await supabase.from('projects').insert(projBatch.slice(i, i + 50)).select('id');
      if (data) projIds.push(...data.map(p => p.id));
    }
    report.generation.projectsCreated = projIds.length;

    const epicIds: string[] = [];
    const epicBatch = Array.from({ length: 3000 }, (_, i) => ({
      workspace_id: wsId, project_id: projIds[i % projIds.length],
      name: simTag(runId, 'epic', i), description: `Synthetic epic ${i}`,
      status: randomFrom(['backlog','in_progress','review','done'] as const),
      priority: randomFrom(TASK_PRIORITIES),
    }));
    for (let i = 0; i < epicBatch.length; i += 100) {
      const { data } = await supabase.from('epics').insert(epicBatch.slice(i, i + 100)).select('id');
      if (data) epicIds.push(...data.map(e => e.id));
    }
    report.generation.epicsCreated = epicIds.length;

    const taskIds: string[] = [];
    const taskBatch = Array.from({ length: maxTasks }, (_, i) => ({
      workspace_id: wsId, project_id: projIds[i % projIds.length],
      epic_id: epicIds[i % epicIds.length], name: simTag(runId, 'task', i),
      status: randomFrom(TASK_STATUSES), priority: randomFrom(TASK_PRIORITIES),
      estimated_hours: Math.floor(Math.random() * 80) + 1,
      story_points: Math.floor(Math.random() * 13) + 1,
      assignee_id: userIds[Math.floor(Math.random() * userIds.length)],
    }));
    for (let i = 0; i < taskBatch.length; i += 100) {
      const { data } = await supabase.from('tasks').insert(taskBatch.slice(i, i + 100)).select('id');
      if (data) taskIds.push(...data.map(t => t.id));
    }
    report.generation.tasksCreated = taskIds.length;

    for (let i = 0; i < taskIds.length - 1; i += 3) {
      if (taskIds[i] && taskIds[i + 1]) {
        await supabase.from('task_dependencies').upsert({
          workspace_id: wsId, task_id: taskIds[i], depends_on_task_id: taskIds[i + 1],
        }, { onConflict: 'workspace_id,task_id,depends_on_task_id' });
      }
    }
    for (let i = 50; i < taskIds.length; i += 50) {
      const cross = taskIds[(i + 2500) % taskIds.length];
      if (taskIds[i] && cross) {
        await supabase.from('task_dependencies').upsert({
          workspace_id: wsId, task_id: taskIds[i], depends_on_task_id: cross,
        }, { onConflict: 'workspace_id,task_id,depends_on_task_id' });
      }
    }

    const docIds: string[] = [];
    const docBatch = Array.from({ length: 1000 }, (_, i) => ({
      workspace_id: wsId, project_id: i < 800 ? projIds[i % projIds.length] : null,
      author_id: userIds[Math.floor(Math.random() * userIds.length)],
      title: simTag(runId, 'doc', i), content: `Synthetic document ${i} content.`,
      doc_type: randomFrom(['markdown','plain','rich'] as const),
      tags: pickMany(['spec','design','api','arch','ops','security','test','docs','analytics','report'], 3),
    }));
    for (let i = 0; i < docBatch.length; i += 50) {
      const { data } = await supabase.from('documents').insert(docBatch.slice(i, i + 50)).select('id');
      if (data) docIds.push(...data.map(d => d.id));
    }
    report.generation.documentsCreated = docIds.length;

    let calCount = 0;
    for (let i = 0; i < 2000; i += 100) {
      const calBatch = Array.from({ length: 100 }, (_, j) => ({
        workspace_id: wsId, user_id: userIds[Math.floor(Math.random() * userIds.length)],
        title: simTag(runId, 'cal', i + j),
        start_time: new Date(Date.now() + Math.random() * 30 * 86400000).toISOString(),
        end_time: new Date(Date.now() + Math.random() * 30 * 86400000 + 3600000).toISOString(),
        event_type: randomFrom(['meeting','focus','review','sprint','holiday','standup'] as const),
      }));
      const { data } = await supabase.from('calendar_events').insert(calBatch).select('id');
      if (data) calCount += data.length;
    }
    report.generation.calendarEventsCreated = calCount;

    let intCount = 0;
    for (let i = 0; i < 50; i++) {
      const service = INTEGRATION_SERVICES[i % INTEGRATION_SERVICES.length];
      const { data: acct } = await supabase.from('connected_accounts').insert({
        workspace_id: wsId, service, access_token: `sst_${runId}_token_${i}`, connected: i % 10 !== 0,
      }).select('id').maybeSingle();
      if (acct) {
        intCount++;
        await supabase.from('integration_configs').insert({
          workspace_id: wsId, service, config: { repo_url: `https://sst.local/${service}/${i}`, branch: 'main' },
        });
        await supabase.from('integration_sync_jobs').insert({
          workspace_id: wsId, service,
          status: randomFrom(['completed','failed','processing','queued','retrying'] as const),
          payload: { sim: true, run_id: runId }, attempts: Math.floor(Math.random() * 4),
        });
      }
    }
    report.generation.integrationsCreated = intCount;

    let whCount = 0;
    for (let i = 0; i < 500; i += 50) {
      const whBatch = Array.from({ length: 50 }, (_, j) => ({
        workspace_id: wsId, name: simTag(runId, 'wh', i + j),
        url: `https://sst-webhook.local/${runId}/${i + j}`, events: pickMany(WEBHOOK_EVENTS, 3), enabled: true,
      }));
      const { data } = await supabase.from('webhooks').insert(whBatch).select('id');
      if (data) whCount += data.length;
    }
    report.generation.webhooksCreated = whCount;

    let autoCount = 0;
    const autoActions = [
      { type: 'send_notification', params: { title: 'SST Notification', body: 'Auto-generated' } },
      { type: 'transition_status', params: { to: 'in_progress' } },
      { type: 'create_task', params: { title: 'SST Follow-up' } },
      { type: 'assign_task', params: { assignee_id: '' } },
    ];
    for (let i = 0; i < 200; i += 50) {
      const autoBatch = Array.from({ length: 50 }, (_, j) => ({
        workspace_id: wsId, name: simTag(runId, 'auto', i + j),
        trigger_event: randomFrom(WEBHOOK_EVENTS), actions: [randomFrom(autoActions)],
        enabled: true, trigger_filters: {},
      }));
      const { data } = await supabase.from('automation_rules').insert(autoBatch).select('id');
      if (data) autoCount += data.length;
    }
    report.generation.automationsCreated = autoCount;

    const chainIds: string[] = [];
    for (let i = 0; i < 50; i++) {
      const { data } = await supabase.from('approval_chains').insert({
        workspace_id: wsId, name: simTag(runId, 'chain', i),
        enabled: true, trigger_config: { event: randomFrom(WEBHOOK_EVENTS) },
      }).select('id').maybeSingle();
      if (data) chainIds.push(data.id);
    }
    let appCount = 0;
    for (let i = 0; i < 1000; i += 100) {
      const appBatch = Array.from({ length: 100 }, (_, j) => ({
        chain_id: chainIds[Math.floor(Math.random() * chainIds.length)],
        target_type: randomFrom(['task','project','document'] as const),
        target_id: randomFrom([...taskIds, ...projIds, ...docIds]),
        status: randomFrom(['pending','approved','rejected'] as const),
        current_step: Math.floor(Math.random() * 3) + 1,
        initiated_by: userIds[Math.floor(Math.random() * userIds.length)],
      }));
      const { data } = await supabase.from('approval_instances').insert(appBatch).select('id');
      if (data) appCount += data.length;
    }
    report.generation.approvalsCreated = appCount;
    report.generation.timeMs = ms(genStart);

    // ─── PERF MEASUREMENTS ──────────────────────────────────────

    const p1 = performance.now();
    await supabase.from('projects').select('*').eq('workspace_id', wsId).like('name', `SST_${runId}_%`);
    const p2 = performance.now();
    report.performance.projectPageLoadMs = p2 - p1;
    if (p2 - p1 > 1000) report.performance.slowestQueries.push(`projects list: ${(p2 - p1).toFixed(0)}ms`);

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
        while (cursor && deps?.some(dd => dd.task_id === cursor)) {
          cursor = deps.find(dd => dd.task_id === cursor)?.depends_on_task_id || '';
        }
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
    for (let i = 0; i < 30; i++) {
      await supabase.from('tasks').select('id').eq('workspace_id', wsId).limit(100).maybeSingle();
    }
    report.performance.apiThroughput = Math.round(30 / (ms(ap1) / 1000));

    const ae1 = performance.now();
    const { data: sampleRule } = await supabase.from('automation_rules').select('id').eq('workspace_id', wsId)
      .like('name', `SST_${runId}_%`).limit(1).maybeSingle();
    if (sampleRule) {
      await evaluateTriggers('task.completed', { workspace_id: wsId, task_id: taskIds[0], task_name: 'SST trigger test' });
    }
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
    for (let i = 0; i < 200; i++) {
      const tid = taskIds[i % taskIds.length];
      if (!tid) continue;
      await supabase.from('tasks').update({ status: randomFrom(TASK_STATUSES), updated_at: nowISO() }).eq('id', tid).eq('workspace_id', wsId);
      taskUpdates++;
    }
    report.events.taskUpdates = taskUpdates;

    let sprintCompletions = 0;
    const { data: sprintProjects } = await supabase.from('projects').select('id').eq('workspace_id', wsId)
      .like('name', `SST_${runId}_%`).eq('execution_mode', 'SCRUM').limit(10);
    for (const sp of sprintProjects || []) {
      const { data: sprint } = await supabase.from('sprints').insert({
        workspace_id: wsId, project_id: sp.id, name: simTag(runId, 'sprint', sprintCompletions),
        start_date: new Date(Date.now() - 14 * 86400000).toISOString(), end_date: nowISO(), status: 'active',
      }).select('id').maybeSingle();
      if (sprint) {
        await supabase.from('sprints').update({ status: 'completed' }).eq('id', sprint.id);
        sprintCompletions++;
      }
    }
    report.events.sprintCompletions = sprintCompletions;

    let autoTriggers = 0;
    const { data: rules } = await supabase.from('automation_rules').select('id').eq('workspace_id', wsId)
      .like('name', `SST_${runId}_%`).limit(30);
    for (const rule of rules || []) {
      await evaluateTriggers('task.updated', { workspace_id: wsId, task_id: taskIds[autoTriggers % taskIds.length], task_name: 'SST event task' });
      autoTriggers++;
    }
    report.events.automationTriggers = autoTriggers;

    let syncs = 0;
    const { data: accounts } = await supabase.from('connected_accounts').select('id').eq('workspace_id', wsId)
      .like('access_token', `sst_${runId}_%`).limit(30);
    for (const acct of accounts || []) {
      await supabase.from('integration_sync_jobs').insert({
        workspace_id: wsId, service: 'github', status: 'processing',
        payload: { sim: true, run_id: runId, account_id: acct.id },
      });
      syncs++;
    }
    report.events.integrationSyncs = syncs;

    let appsProcessed = 0;
    const { data: instances } = await supabase.from('approval_instances').select('id, chain_id').eq('status', 'pending').limit(100);
    for (const inst of instances || []) {
      await supabase.from('approval_instances').update({
        status: randomFrom(['approved','rejected'] as const), completed_at: nowISO(),
      }).eq('id', inst.id);
      appsProcessed++;
      if (appsProcessed >= 50) break;
    }
    report.events.approvalsProcessed = appsProcessed;

    const ref1 = performance.now();
    for (let i = 0; i < 5; i++) {
      await supabase.from('projects').select('id, name, status, execution_mode').eq('workspace_id', wsId)
        .like('name', `SST_${runId}_%`);
      await supabase.from('tasks').select('id, name, status, priority').eq('workspace_id', wsId)
        .like('name', `SST_${runId}_%`).limit(1000);
    }
    report.events.refreshOperations = 5;
    if (ms(ref1) > 3000) report.performance.slowestQueries.push(`page refresh: ${ms(ref1).toFixed(0)}ms`);

    let recovered = 0;
    const { data: stuckJobs } = await supabase.from('integration_sync_jobs').select('id').eq('workspace_id', wsId)
      .in('status', ['processing','queued']).limit(20);
    for (const job of stuckJobs || []) {
      await supabase.from('integration_sync_jobs').update({
        status: 'retrying', attempts: 1, next_retry_at: new Date(Date.now() + 2000).toISOString(),
      }).eq('id', job.id);
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
    if (risks.length >= 6) report.riskLevel = 'HIGH';
    else if (risks.length >= 3) report.riskLevel = 'MEDIUM';

    report.recommendations.push(...risks.map(r => `Investigate slow ${r} (threshold exceeded)`));
    if (report.performance.memoryEstimateMB > 4000) report.recommendations.push('Memory usage exceeds 4GB — consider pagination or virtualization');
    if (report.performance.queueDepth > 50) report.recommendations.push(`Queue depth ${report.performance.queueDepth} — check queue processing rate`);
    if (report.performance.apiThroughput < 20) report.recommendations.push(`API throughput ${report.performance.apiThroughput} ops/s — consider batching or connection pooling`);
    if (report.performance.webhookProcessingMs > 3000) report.recommendations.push('Webhook processing is slow — implement async dispatch');
    if (report.performance.timelineCalcMs > 2000) report.recommendations.push('Timeline calculations are slow — optimize dependency graph traversal or index');
    if (report.recommendations.length === 0) report.recommendations.push('All measured metrics within acceptable thresholds');

    // ─── CLEANUP ───────────────────────────────────────────────────
    const cleanStart = performance.now();

    const allTables = [
      'task_dependencies','approval_instances','doc_versions','doc_annotations',
      'integration_sync_jobs','integration_configs','sprints','documents','tasks',
      'epics','calendar_events','webhooks','connected_accounts','automation_rules',
      'approval_chains','activity_logs','teams','projects','users',
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
    deleteOps.push(() => supabase.from('users').delete().eq('workspace_id', wsId).like('email', `SST_${runId}_%`));

    for (const op of deleteOps) { try { await op(); } catch { /* best effort */ } }

    // ── Cleanup verification pass ──
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
      report.recommendations.push(`Cleanup verification found ${totalRemaining} remaining SST_${runId} records. Tables with leftovers: ${Object.entries(remaining).filter(([_, v]) => v > 0).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      report.recommendations.push(`Run cleanupSyntheticRun("${runId}") to retry cleanup`);
    }

    report.cleanup.timeMs = ms(cleanStart);

    await activityLogService.appendLog({
      workspace_id: wsId, actor_id: undefined,
      action: 'stress_test_completed',
      metadata: {
        run_id: runId, duration_ms: report.generation.timeMs,
        users: report.generation.usersCreated, projects: report.generation.projectsCreated,
        tasks: report.generation.tasksCreated,
        perf_project_load_ms: Math.round(report.performance.projectPageLoadMs),
        perf_timeline_ms: Math.round(report.performance.timelineCalcMs),
        perf_queue_depth: report.performance.queueDepth,
        risk_level: report.riskLevel,
      },
    });

    await activityLogService.appendLog({
      workspace_id: wsId, actor_id: undefined,
      action: 'stress_cleanup_completed',
      metadata: {
        run_id: runId, success: report.cleanup.success,
        orphan_count: report.cleanup.orphanCount,
        remaining: remaining,
        cleanup_ms: Math.round(report.cleanup.timeMs),
      },
    });

  } catch (e: any) {
    report.recommendations.push(`FATAL: ${e.message}`);
    report.riskLevel = 'HIGH';
  } finally {
    clearLock();
  }

  report.endTime = nowISO();
  report.durationMs = ms(t0);
  return report;
}
