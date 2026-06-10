import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { trackSupabaseOperation } from '../core/observability/telemetry';
import { ActionType, DecisionInsight } from '../core/decision/DecisionIntelligenceEngine';
import { createApprovalInstance } from './approvalService';
import { validateExecutionSafety } from '../core/decision/DecisionSafetyGuard';

export async function executeDecisionAction(
  workspaceId: string,
  userId: string,
  insight: DecisionInsight,
  isHighRisk: boolean = false
): Promise<{ success: boolean; requiresApproval: boolean; message: string }> {
  if (!isSupabaseConfigured) return { success: false, requiresApproval: false, message: 'Database not configured' };

  const { actionType, actionPayload: payload, id: insightId, expectedImpactMetrics } = insight;

  try {
    const safetyCheck = await validateExecutionSafety(actionType!, payload || {}, workspaceId);
    if (!safetyCheck.isSafe) {
      await logDecisionHistory(workspaceId, insightId, actionType!, 'Execution Blocked by Safety Guard', expectedImpactMetrics, 'rejected');
      return { success: false, requiresApproval: false, message: `Action blocked: ${safetyCheck.blockReason}` };
    }
    // 1. Check if High Risk (Requires Approval)
    if (isHighRisk) {
      // Create Approval Request
      const approval = await createApprovalInstance({
        chain_id: 'auto-decision-chain', // Assuming a predefined chain or we dynamically assign
        target_type: 'decision_action',
        target_id: insightId,
        initiated_by: userId
      }, workspaceId);

      // Log to recommendation history
      await logDecisionHistory(workspaceId, insightId, actionType!, 'Approval Requested', expectedImpactMetrics, 'pending');

      return { success: true, requiresApproval: true, message: 'High-risk action flagged. Approval request submitted.' };
    }

    // 2. Direct Execution
    if (actionType === 'TASK_REASSIGNMENT') {
      const { target_user_id, tasks } = payload || {};
      if (tasks && tasks.length > 0) {
        await trackSupabaseOperation('supabase_update_tasks', () => 
          supabase.from('tasks').update({ assignee_id: target_user_id }).in('id', tasks)
        );
      }
    } else if (actionType === 'BLOCKER_ESCALATION') {
      const { blocker_ids } = payload || {};
      if (blocker_ids && blocker_ids.length > 0) {
        // Escalate by adding a note or tagging PM (implementation depends on execution_blockers table structure)
        // Just an example update if it were in a dedicated table
      }
    }

    // Log to recommendation history
    await logDecisionHistory(workspaceId, insightId, actionType!, 'Direct Execution', expectedImpactMetrics, 'executed');

    return { success: true, requiresApproval: false, message: 'Action executed successfully.' };

  } catch (error: any) {
    console.error('Failed to execute decision action:', error);
    return { success: false, requiresApproval: false, message: error.message };
  }
}

export async function syncDecisionLifecycleStates(
  workspaceId: string,
  currentInsights: DecisionInsight[]
): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    const { data: activeHistories } = await supabase
      .from('decision_recommendation_history')
      .select('insight_id, status')
      .eq('workspace_id', workspaceId)
      .in('status', ['open', 'viewed', 'simulated', 'approval_pending']);

    if (activeHistories && activeHistories.length > 0) {
      const currentInsightIds = new Set(currentInsights.map(i => i.id));
      
      const expiredIds = activeHistories
        .filter(h => !currentInsightIds.has(h.insight_id))
        .map(h => h.insight_id);

      if (expiredIds.length > 0) {
        await trackSupabaseOperation('supabase_expire_decision_history', () =>
          supabase
            .from('decision_recommendation_history')
            .update({ status: 'expired' })
            .eq('workspace_id', workspaceId)
            .in('insight_id', expiredIds)
        );
      }
    }
  } catch (e) {
    console.error('Failed to sync decision lifecycle states', e);
  }
}

export async function logDecisionHistory(
  workspaceId: string,
  insightId: string,
  actionType: string,
  recommendedAction: string,
  predictedImpact: any,
  status: string
) {
  if (!isSupabaseConfigured) return;
  try {
    await trackSupabaseOperation('supabase_insert_decision_history', () => 
      supabase.from('decision_recommendation_history').insert({
        workspace_id: workspaceId,
        insight_id: insightId,
        action_type: actionType,
        detected_problem: 'Detected by Intelligence Engine',
        recommended_action: recommendedAction,
        predicted_impact: predictedImpact,
        status,
        executed_at: status === 'executed' ? new Date().toISOString() : null
      })
    );
  } catch {
    // ignore
  }
}
