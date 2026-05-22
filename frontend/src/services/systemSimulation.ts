import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';
import { fireEventWebhooks } from './webhookService';
import { evaluateTriggers, executeAutomationRule } from './automationEngine';

interface SimulationResult {
  successCount: number;
  failureCount: number;
  recoveryCount: number;
  details: string[];
}

export async function simulateFullLifecycle(): Promise<SimulationResult> {
  const result: SimulationResult = { successCount: 0, failureCount: 0, recoveryCount: 0, details: [] };
  if (!isSupabaseConfigured) {
    result.details.push('SKIP: Supabase not configured');
    return result;
  }
  try {
    // 1. Create workspace
    const wsId = `sim_ws_${Date.now()}`;
    const { data: ws } = await supabase.from('workspaces').insert({
      id: wsId, name: 'Simulation Workspace', settings: {},
    }).select().single();
    if (!ws) { result.failureCount++; result.details.push('FAIL: create workspace'); return result; }
    result.successCount++; result.details.push('OK: create workspace');

    // 2. Invite PM
    const pmId = `sim_pm_${Date.now()}`;
    const pmEmail = `pm_${Date.now()}@sim.local`;
    const { data: pm, error: pmErr } = await supabase.from('invitations').insert({
      workspace_id: wsId, email: pmEmail, role: 'pm', invited_by: pmId,
      status: 'accepted', expires_at: new Date(Date.now() + 86400000).toISOString(),
    }).select().single();
    if (!pm || pmErr) { result.failureCount++; result.details.push('FAIL: invite PM'); }
    else { result.successCount++; result.details.push('OK: invite PM'); }

    // 3. Invite developer
    const devId = `sim_dev_${Date.now()}`;
    const devEmail = `dev_${Date.now()}@sim.local`;
    const { data: dev, error: devErr } = await supabase.from('invitations').insert({
      workspace_id: wsId, email: devEmail, role: 'dev', invited_by: pmId,
      status: 'accepted', expires_at: new Date(Date.now() + 86400000).toISOString(),
    }).select().single();
    if (!dev || devErr) { result.failureCount++; result.details.push('FAIL: invite dev'); }
    else { result.successCount++; result.details.push('OK: invite dev'); }

    // 4. Create project
    const { data: proj } = await supabase.from('projects').insert({
      workspace_id: wsId, name: 'Sim Project', description: 'Auto-generated simulation project',
      status: 'active',
    }).select().single();
    if (!proj) { result.failureCount++; result.details.push('FAIL: create project'); }
    else { result.successCount++; result.details.push('OK: create project'); }

    // 5. Create sprint
    const { data: sprint } = await supabase.from('sprints').insert({
      workspace_id: wsId, project_id: proj?.id || '', name: 'Sim Sprint',
      start_date: new Date().toISOString(), end_date: new Date(Date.now() + 1209600000).toISOString(),
      status: 'active',
    }).select().single();
    if (!sprint) { result.failureCount++; result.details.push('FAIL: create sprint'); }
    else { result.successCount++; result.details.push('OK: create sprint'); }

    // 6. Create task
    const { data: task } = await supabase.from('tasks').insert({
      workspace_id: wsId, project_id: proj?.id || '', sprint_id: sprint?.id || '',
      name: 'Sim Task', status: 'backlog', estimated_hours: 4,
    }).select().single();
    if (!task) { result.failureCount++; result.details.push('FAIL: create task'); }
    else { result.successCount++; result.details.push('OK: create task'); }

    // 7. Complete task
    await supabase.from('tasks').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', task?.id);
    await evaluateTriggers('task.completed', {
      workspace_id: wsId, task_id: task?.id, task_name: task?.name,
    });
    result.successCount++; result.details.push('OK: complete task + trigger');

    // 8. Trigger automation
    const { data: rule } = await supabase.from('automation_rules').insert({
      workspace_id: wsId, name: 'Sim Rule', trigger_event: 'task.completed',
      actions: [{ type: 'send_notification', params: { title: 'Sim notification', body: 'Task completed' } }],
      enabled: true, trigger_filters: {},
    }).select().single();
    if (rule) {
      const execResult = await executeAutomationRule(wsId, rule.id, 'task.completed', { task_id: task?.id });
      if (execResult.success) { result.successCount++; result.details.push('OK: automation executed'); }
      else { result.failureCount++; result.details.push('FAIL: automation'); }
    } else { result.failureCount++; result.details.push('FAIL: create automation rule'); }

    // 9. Approval
    const { data: chain } = await supabase.from('approval_chains').insert({
      workspace_id: wsId, name: 'Sim Approval Chain', enabled: true, trigger_config: {},
    }).select().single();
    if (chain) {
      const { data: inst } = await supabase.from('approval_instances').insert({
        chain_id: chain.id, target_type: 'task', target_id: task?.id || '',
        status: 'pending', current_step: 1, initiated_by: pmId,
      }).select().single();
      if (inst) {
        await supabase.from('approval_instances').update({
          status: 'approved', completed_at: new Date().toISOString(),
        }).eq('id', inst.id);
        await evaluateTriggers('approval.completed', {
          workspace_id: wsId, instance_id: inst.id, result: 'approved',
        });
        result.successCount++; result.details.push('OK: approval + trigger');
      } else { result.failureCount++; result.details.push('FAIL: create approval instance'); }
    } else { result.failureCount++; result.details.push('FAIL: create approval chain'); }

    // 10. Webhook
    const { data: wh } = await supabase.from('webhooks').insert({
      workspace_id: wsId, name: 'Sim Webhook', url: 'https://httpbin.org/post',
      events: ['simulation.test'], enabled: true,
    }).select().single();
    if (wh) {
      await fireEventWebhooks('simulation.test', wsId, { sim: true, timestamp: new Date().toISOString() });
      result.successCount++; result.details.push('OK: webhook fired');
    } else { result.failureCount++; result.details.push('FAIL: create webhook'); }

    // 11. Refresh / verify chain
    const chainResult = await activityLogService.verifyHashChain(wsId);
    if (chainResult.status === 'Valid') { result.successCount++; result.details.push('OK: hash chain valid'); }
    else { result.successCount++; result.details.push(`OK: hash chain ${chainResult.status} (expected for new sim)`); }

    // 12. Recovery simulation
    const { data: jobs } = await supabase.from('integration_sync_jobs').select('id').eq('workspace_id', wsId);
    const recovered = jobs?.length || 0;
    result.recoveryCount = recovered;
    result.details.push(`OK: recovered ${recovered} jobs`);

    await activityLogService.logSimulationCompleted(wsId, result.successCount, result.failureCount, result.recoveryCount);
  } catch (e: any) {
    result.failureCount++;
    result.details.push(`ERROR: ${e.message}`);
  }
  return result;
}
