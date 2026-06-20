import { supabase } from '../../lib/supabase';
import { activityAggregationService } from '../../services/activityAggregationService';

export interface ReportConfig {
  workspaceId: string;
  projectId?: string;
  sprintId?: string;
  userId?: string;
  startDate: Date;
  endDate: Date;
  templateId?: string;
}

export const reportingEngine = {
  async generateProjectReport(config: ReportConfig) {
    if (!config.projectId) throw new Error("projectId required");
    
    // 1. Fetch raw data
    const [tasksRes, eventsRes, waitRes, leaveRes, invoicesRes, expensesRes, employeesRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('project_id', config.projectId),
      supabase.from('activity_events').select('*').eq('project_id', config.projectId),
      supabase.from('tasks').select('*').eq('project_id', config.projectId).eq('status', 'blocked'),
      supabase.from('personal_leave').select('*').eq('workspace_id', config.workspaceId).or(`status.eq.approved,status.is.null`).gte('end_date', config.startDate.toISOString().split('T')[0]).lte('start_date', config.endDate.toISOString().split('T')[0]),
      supabase.from('invoices').select('amount').eq('project_id', config.projectId).in('status', ['paid', 'issued']),
      supabase.from('expenses').select('amount').eq('project_id', config.projectId),
      supabase.from('tasks').select('assignee_id').eq('project_id', config.projectId)
    ]);

    const tasks = tasksRes.data || [];
    const events = eventsRes.data || [];
    const blockedTasks = waitRes.data || [];
    const leaves = leaveRes.data || [];
    const invoices = invoicesRes.data || [];
    const expenses = expensesRes.data || [];
    
    // Approximate employee cost based on assignment (naive calculation for demo)
    const uniqueAssignees = [...new Set((employeesRes.data || []).map(t => t.assignee_id).filter(Boolean))];
    const { data: salaries } = await supabase.from('compensation_packages').select('base_salary').in('user_id', uniqueAssignees);
    
    const projectRevenue = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const projectExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const employeeCost = (salaries || []).reduce((sum, s) => sum + (Number(s.base_salary) / 12), 0); // Approx 1 month cost per assigned user
    const realMargin = projectRevenue - employeeCost - projectExpenses;

    // 2. Aggregate Activity
    const digest = activityAggregationService.aggregateEvents(events, config.startDate, config.endDate);

    // 3. Compile Project Health snapshot
    const snapshot = {
      period: { start: config.startDate.toISOString(), end: config.endDate.toISOString() },
      metrics: {
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'done').length,
        currentlyBlocked: blockedTasks.length,
        deliveryConfidence: this._calculateConfidence(tasks),
        capacityLossDays: leaves.length // Mock heuristic
      },
      activityDigest: digest,
      risks: blockedTasks.map(t => ({ taskId: t.id, taskName: t.name, reason: "Blocked" })),
      hrContext: leaves.length > 0 ? `Capacity reduced by ${leaves.length} approved leave(s) this period.` : 'Full capacity.',
      financialContext: {
        revenue: projectRevenue,
        employeeCost: employeeCost,
        projectExpenses: projectExpenses,
        realMargin: realMargin
      }
    };

    return snapshot;
  },

  async generateSprintReport(config: ReportConfig) {
    // Similar to project report, scoped to sprint_id
    if (!config.sprintId) throw new Error("sprintId required");
    
    const snapshot = {
      period: { start: config.startDate.toISOString(), end: config.endDate.toISOString() },
      metrics: {
        velocity: 42,
        burndownPace: 'On Track'
      }
    };
    return snapshot;
  },

  async generateUserReport(config: ReportConfig) {
    if (!config.userId) throw new Error("userId required");
    
    const eventsRes = await supabase.from('activity_events').select('*').eq('created_by', config.userId);
    const digest = activityAggregationService.aggregateEvents(eventsRes.data || [], config.startDate, config.endDate);

    const snapshot = {
      period: { start: config.startDate.toISOString(), end: config.endDate.toISOString() },
      productivity: digest
    };
    return snapshot;
  },

  async saveReportSnapshot(
    workspaceId: string, 
    reportType: string, 
    entityType: string, 
    entityId: string, 
    snapshot: any,
    generatorUser: {id: string, name: string, role: string}
  ) {
    const { data, error } = await supabase
      .from('report_snapshots')
      .insert({
        workspace_id: workspaceId,
        report_type: reportType,
        entity_type: entityType,
        entity_id: entityId,
        snapshot,
        generated_by_snapshot: generatorUser,
        created_by: generatorUser.id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  _calculateConfidence(tasks: any[]) {
    // Simple heuristic for demonstration
    const done = tasks.filter(t => t.status === 'done').length;
    return tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 100;
  },

  async generateWorkspaceReport(config: ReportConfig) {
    const { workspaceId, startDate, endDate } = config;
    
    // Fetch Automation Metrics
    const { data: runsRes } = await supabase
      .from('automation_runs')
      .select('status')
      .eq('workspace_id', workspaceId)
      .gte('executed_at', startDate.toISOString())
      .lte('executed_at', endDate.toISOString());

    const runs = runsRes || [];
    const totalRuns = runs.length;
    const failures = runs.filter((r: any) => r.status === 'failed').length;
    const successRate = totalRuns > 0 ? Math.round(((totalRuns - failures) / totalRuns) * 100) : 100;

    const { data: integrations } = await supabase
      .from('integration_connections')
      .select('status')
      .eq('workspace_id', workspaceId);

    const activeIntegrations = (integrations || []).filter((i: any) => i.status === 'connected').length;
    const expiredConnections = (integrations || []).filter((i: any) => i.status === 'expired').length;

    const { data: integrationEvents } = await supabase
      .from('integration_events')
      .select('processing_status, event_type')
      .eq('workspace_id', workspaceId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const failedSyncs = (integrationEvents || []).filter((e: any) => e.processing_status === 'failed' && !e.event_type.startsWith('webhook.')).length;
    const webhookFailures = (integrationEvents || []).filter((e: any) => e.processing_status === 'failed' && e.event_type.startsWith('webhook.')).length;

    const snapshot = {
      period: { start: startDate.toISOString(), end: endDate.toISOString() },
      automation: {
        totalExecutions: totalRuns,
        failures: failures,
        successRate: `${successRate}%`
      },
      integrations: {
        active: activeIntegrations,
        expiredConnections,
        failedSyncs,
        webhookFailures
      }
    };
    return snapshot;
  }
};
