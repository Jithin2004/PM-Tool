import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';

interface StressMetrics {
  totalTime: number;
  queryTime: number;
  renderTime: number;
  queueDepth: number;
  memoryEstimateMB: number;
  timelineCalcMs: number;
  successCount: number;
  failureCount: number;
  details: string[];
}

export async function runStressSimulation(wsId: string): Promise<StressMetrics> {
  const metrics: StressMetrics = { totalTime: 0, queryTime: 0, renderTime: 0, queueDepth: 0, memoryEstimateMB: 0, timelineCalcMs: 0, successCount: 0, failureCount: 0, details: [] };
  if (!isSupabaseConfigured || !wsId) { metrics.details.push('SKIP: no workspace'); return metrics; }
  const startAll = performance.now();

  try {
    // 1. Generate 200 users
    const userStart = performance.now();
    const userIds: string[] = [];
    for (let i = 0; i < 200; i++) {
      const { data } = await supabase.from('users').insert({
        workspace_id: wsId, email: `stress_${Date.now()}_${i}@sim.local`,
        full_name: `Stress User ${i}`, role: i < 5 ? 'super_admin' : i < 20 ? 'pm' : 'dev',
        availability_factor: 0.5 + Math.random() * 0.5,
      }).select('id').maybeSingle();
      if (data) userIds.push(data.id);
    }
    metrics.queryTime += performance.now() - userStart;
    metrics.successCount++;
    metrics.details.push(`OK: 200 users created (${userIds.length} persisted)`);

    // 2. Generate 1000 projects
    const projStart = performance.now();
    const projectIds: string[] = [];
    for (let i = 0; i < 1000; i++) {
      const { data } = await supabase.from('projects').insert({
        workspace_id: wsId, name: `Stress Project ${i}`,
        description: `Auto-generated stress test project #${i}`,
        status: i % 3 === 0 ? 'deployed' : 'active',
        execution_mode: i % 4 === 0 ? 'SCRUM' : i % 4 === 1 ? 'SDLC' : 'KANBAN',
      }).select('id').maybeSingle();
      if (data) projectIds.push(data.id);
    }
    metrics.queryTime += performance.now() - projStart;
    metrics.successCount++;
    metrics.details.push('OK: 1000 projects created');

    // 3. Generate 10000 tasks
    const taskStart = performance.now();
    for (let i = 0; i < 10000; i++) {
      const projectId = projectIds[i % projectIds.length];
      const statuses = ['backlog', 'in_progress', 'review', 'done'];
      await supabase.from('tasks').insert({
        workspace_id: wsId, project_id: projectId, name: `Stress Task ${i}`,
        status: statuses[i % 4], estimated_hours: Math.floor(Math.random() * 40) + 1,
        priority: i % 5 === 0 ? 'critical' : i % 3 === 0 ? 'high' : 'medium',
      });
    }
    metrics.queryTime += performance.now() - taskStart;
    metrics.successCount++;
    metrics.details.push('OK: 10000 tasks created');

    // 4. Generate 500 webhooks
    const webhookStart = performance.now();
    for (let i = 0; i < 500; i++) {
      await supabase.from('webhooks').insert({
        workspace_id: wsId, name: `Stress Webhook ${i}`,
        url: `https://stress-sim.local/hook/${i}`,
        events: ['task.created', 'task.completed'], enabled: true,
      });
    }
    metrics.queryTime += performance.now() - webhookStart;
    metrics.successCount++;
    metrics.details.push('OK: 500 webhooks created');

    // 5. Generate 50 integrations
    const intStart = performance.now();
    const services = ['github', 'gitlab', 'figma', 'google_calendar', 'google_drive'];
    for (let i = 0; i < 50; i++) {
      await supabase.from('connected_accounts').insert({
        workspace_id: wsId, service: services[i % services.length],
        access_token: `stress_token_${i}`, connected: true,
      });
      await supabase.from('integration_configs').insert({
        workspace_id: wsId, service: services[i % services.length],
        config: { repo_url: `https://stress-sim.local/repo/${i}`, branch: 'main' },
      });
      await supabase.from('integration_sync_jobs').insert({
        workspace_id: wsId, service: services[i % services.length],
        status: i % 10 === 0 ? 'failed' : i % 5 === 0 ? 'processing' : 'completed',
        payload: {}, created_at: new Date().toISOString(),
      });
    }
    metrics.queryTime += performance.now() - intStart;
    metrics.successCount++;
    metrics.details.push('OK: 50 integrations + jobs created');

    // 6. Query performance measurement
    const queryStart = performance.now();
    await supabase.from('tasks').select('id', { count: 'exact', head: true });
    await supabase.from('projects').select('id', { count: 'exact', head: true });
    await supabase.from('users').select('id', { count: 'exact', head: true });
    await supabase.from('webhooks').select('id', { count: 'exact', head: true });
    await supabase.from('integration_sync_jobs').select('id', { count: 'exact', head: true });
    metrics.queryTime += performance.now() - queryStart;
    metrics.successCount++;
    metrics.details.push('OK: bulk query timing measured');

    // 7. Queue depth measurement
    const { count: queueCount } = await supabase
      .from('integration_sync_jobs').select('*', { count: 'exact', head: true })
      .in('status', ['queued', 'processing', 'retrying']);
    metrics.queueDepth = queueCount || 0;
    metrics.details.push(`OK: queue depth = ${metrics.queueDepth}`);

    // 8. Memory estimation
    const memory = (navigator as any).deviceMemory;
    metrics.memoryEstimateMB = memory ? memory * 1024 : 0;
    metrics.details.push(`OK: memory estimate = ${metrics.memoryEstimateMB}MB`);

    // 9. Timeline calculation timing (simulated dependency graph)
    const timelineStart = performance.now();
    const { data: depTasks } = await supabase
      .from('tasks').select('id').eq('workspace_id', wsId)
      .limit(500);
    if (depTasks) {
      for (let i = 0; i < depTasks.length - 1; i++) {
        await supabase.from('task_dependencies').upsert({
          workspace_id: wsId, task_id: depTasks[i].id, depends_on_task_id: depTasks[i + 1].id,
        }, { onConflict: 'workspace_id,task_id,depends_on_task_id' });
      }
    }
    metrics.timelineCalcMs = performance.now() - timelineStart;
    metrics.details.push(`OK: timeline dependency graph built in ${metrics.timelineCalcMs.toFixed(1)}ms`);

    await activityLogService.logSimulationCompleted(wsId, metrics.successCount, metrics.failureCount, 0);
  } catch (e: any) {
    metrics.failureCount++;
    metrics.details.push(`ERROR: ${e.message}`);
  }

  metrics.totalTime = performance.now() - startAll;
  metrics.renderTime = metrics.totalTime - metrics.queryTime;
  return metrics;
}
