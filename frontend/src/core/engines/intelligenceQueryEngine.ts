import { supabase } from '../../lib/supabase';

export interface DeliveryHealth {
  status: 'healthy' | 'watch' | 'risk';
  reasons: string[];
  suggestedAction: string;
}

export interface WorkloadInsight {
  userId: string;
  insights: string[];
}

export interface EstimateLearning {
  similarTasksCount: number;
  averageVariance: number;
  insight: string;
}

export interface ActivityAnomaly {
  type: string;
  count: number;
  insight: string;
}

export const intelligenceQueryEngine = {
  /**
   * 1. Delivery Health
   * Checks sprint completion trend, reopen frequency, blocked trend.
   */
  async getDeliveryHealth(workspaceId: string, projectId?: string): Promise<DeliveryHealth> {
    const { data: trend } = await supabase.rpc('get_delivery_health_trend', { p_workspace_id: workspaceId });
    
    if (!trend) {
      return { status: 'healthy', reasons: ['Delivery pattern looks stable.'], suggestedAction: 'Keep up the good work.' };
    }

    const { recent_blocked, recent_reopened, recent_completed, old_blocked, old_completed } = trend as any;

    const reasons: string[] = [];
    let status: 'healthy' | 'watch' | 'risk' = 'healthy';
    let suggestedAction = 'Keep up the good work.';

    if (recent_blocked > old_blocked * 1.5 && recent_blocked > 3) {
      reasons.push('Blocked work has increased recently.');
      status = 'watch';
      suggestedAction = 'Focus on unblocking tasks to restore flow.';
    }

    if (recent_reopened > 5) {
      reasons.push('Tasks are frequently being reopened.');
      status = status === 'healthy' ? 'watch' : 'risk';
      suggestedAction = 'Review task acceptance criteria to reduce reopenings.';
    }

    if (recent_completed < old_completed * 0.5 && old_completed > 5) {
      reasons.push('Task completion pace has slowed down.');
      status = 'watch';
      suggestedAction = 'Identify bottlenecks slowing down task completion.';
    }

    if (reasons.length === 0) {
      reasons.push('Delivery pattern looks stable.');
    }

    if (status === 'risk') {
      suggestedAction = 'Immediate intervention required to address blockers and quality issues.';
    }

    return { status, reasons, suggestedAction };
  },

  /**
   * 2. Workload Intelligence
   * Adaptive fallback: User -> Role -> Workspace -> Not enough history
   */
  async getWorkloadIntelligence(workspaceId: string, userId: string, role: string = 'member'): Promise<WorkloadInsight> {
    const { data: userTasks } = await supabase
      .from('tasks')
      .select('id, estimated_hours')
      .eq('workspace_id', workspaceId)
      .eq('assignee_id', userId)
      .neq('status', 'done');

    const activeCount = userTasks?.length || 0;
    const activeHours = (userTasks || []).reduce((acc, t) => acc + (t.estimated_hours || 0), 0);

    const { data: baseline } = await supabase.rpc('get_user_workload_baseline', {
      p_workspace_id: workspaceId,
      p_user_id: userId,
      p_role: role
    });

    const insights: string[] = [];

    if (baseline) {
      const { user_history, role_history, workspace_history } = baseline as any;
      let comparator = null;
      let basis = '';

      if (user_history.tasks_completed >= 5) {
        comparator = user_history;
        basis = 'user';
      } else if (role_history.avg_tasks_completed >= 3) {
        comparator = role_history;
        basis = 'role';
      } else if (workspace_history.avg_tasks_completed >= 3) {
        comparator = workspace_history;
        basis = 'workspace';
      }

      if (!comparator) {
        insights.push('More history is needed before workload suggestions appear.');
        return { userId, insights };
      }

      const avgTasks = basis === 'user' ? comparator.tasks_completed : comparator.avg_tasks_completed;
      const avgHours = basis === 'user' ? comparator.hours_completed : comparator.avg_hours_completed;

      // Current workload is active workload. We compare active to what they finish in a month.
      // E.g. If active tasks > 1.5x what they finish in a week (avgTasks / 4)
      const weeklyAvgTasks = avgTasks / 4.0;
      const weeklyAvgHours = avgHours / 4.0;

      if (activeCount > weeklyAvgTasks * 1.5 && activeCount >= 3) {
        insights.push('Workload is higher than this person\'s usual completed workload.');
      } else if (activeHours > weeklyAvgHours * 1.5 && activeHours >= 10) {
        insights.push('Workload increased recently.');
      }
    }

    if (insights.length === 0 && activeCount > 0) {
      insights.push('Looks normal.');
    }

    return { userId, insights };
  },

  /**
   * 3. Estimate Learning
   * Compare estimate against historical data of similar size + same assignee/project
   */
  async getEstimateLearning(workspaceId: string, currentEstimateHours: number, assigneeId?: string, projectId?: string): Promise<EstimateLearning> {
    if (!assigneeId || !projectId) {
      return {
        similarTasksCount: 0,
        averageVariance: 1,
        insight: 'More completed tasks are needed before estimate suggestions appear.'
      };
    }

    const { data: lookup } = await supabase.rpc('get_estimate_history_lookup', {
      p_workspace_id: workspaceId,
      p_assignee_id: assigneeId,
      p_project_id: projectId,
      p_current_estimate: currentEstimateHours
    });

    if (!lookup || lookup.samples === 0) {
      return {
        similarTasksCount: 0,
        averageVariance: 1,
        insight: 'More completed tasks are needed before estimate suggestions appear.'
      };
    }

    const avgVariance = lookup.variance;
    let insight = 'Looks normal.';

    if (avgVariance > 1.2) {
      insight = 'This estimate looks low based on similar completed tasks.';
    } else if (avgVariance < 0.8) {
      insight = 'This estimate might be high based on similar completed tasks.';
    }

    return {
      similarTasksCount: lookup.samples,
      averageVariance: avgVariance,
      insight
    };
  },

  /**
   * 5. Activity Anomaly Detection
   * Compare 24h activity against 30d daily average. Only flag unusual spikes (> 1.5x).
   */
  async getActivityAnomalies(workspaceId: string): Promise<ActivityAnomaly[]> {
    const { data: baseline } = await supabase.rpc('get_workspace_activity_baseline', {
      p_workspace_id: workspaceId
    });

    if (!baseline) return [];

    const { recent_24h, daily_avg_30d } = baseline as any;
    const anomalies: ActivityAnomaly[] = [];

    const checkSpike = (action: string, label: string) => {
      const recent = recent_24h[action] || 0;
      const avg = daily_avg_30d[action] || 0;
      // Only flag if it's significantly higher than normal and at least 3 occurrences
      if (recent > avg * 1.5 && recent >= 3) {
        anomalies.push({ type: action, count: recent, insight: `Unusual amount of ${label} happened recently.` });
      }
    };

    checkSpike('task_deleted', 'task deletions');
    checkSpike('task_reopened', 'reopened tasks');
    checkSpike('task_status_changed', 'status changes');
    checkSpike('milestone_shifted', 'milestone shifts');
    checkSpike('permission_changed', 'permission changes');
    checkSpike('role_changed', 'role changes');
    checkSpike('journal_reversal_created', 'financial reversals');

    return anomalies;
  }
};
