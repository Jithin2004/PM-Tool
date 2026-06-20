import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { confidenceCalibrationService, getConfidenceBucket } from './confidenceCalibrationService';
import { activityLogService } from './activityLogService';

export interface ContextAccuracy {
  context_type: string;
  context_value: string;
  historical_accuracy: number;
  mean_error: number;
  overconfidence_rate: number;
  underconfidence_rate: number;
  sample_size: number;
}

export type ContextType = 'assignee' | 'task_category' | 'project_type' | 'execution_mode' | 'industry';

export const CONTEXT_TYPES: ContextType[] = ['assignee', 'task_category', 'project_type', 'execution_mode', 'industry'];

export function inferTaskCategory(taskName: string, tags?: string[]): string {
  if (tags && tags.length > 0) return tags[0].toLowerCase();
  const name = taskName.toLowerCase();
  const patterns: { keywords: string[]; category: string }[] = [
    { keywords: ['api', 'endpoint', 'rest', 'graphql'], category: 'api' },
    { keywords: ['frontend', 'ui', 'page', 'component', 'screen', 'layout'], category: 'frontend' },
    { keywords: ['backend', 'service', 'server', 'middleware', 'db', 'database', 'migration'], category: 'backend' },
    { keywords: ['test', 'spec', 'e2e', 'integration', 'unit'], category: 'testing' },
    { keywords: ['devops', 'deploy', 'ci', 'cd', 'infra', 'docker'], category: 'devops' },
    { keywords: ['research', 'spike', 'investigate', 'poc', 'prototype'], category: 'research' },
    { keywords: ['bug', 'fix', 'hotfix', 'patch'], category: 'bugfix' },
    { keywords: ['docs', 'documentation', 'readme'], category: 'documentation' },
    { keywords: ['security', 'auth', 'permission', 'rbac'], category: 'security' },
    { keywords: ['design', 'figma', 'mockup', 'wireframe'], category: 'design' },
    { keywords: ['data', 'analytics', 'report', 'dashboard', 'metric'], category: 'data' },
    { keywords: ['config', 'setup', 'onboarding', 'init'], category: 'configuration' },
  ];
  for (const { keywords, category } of patterns) {
    if (keywords.some(k => name.includes(k))) return category;
  }
  return 'general';
}

export const contextPredictionService = {
  async recordContextOutcome(
    workspaceId: string,
    taskId: string,
    predictedConfidence: number,
    predictionErrorDays: number,
    contexts: Array<{ type: ContextType; value: string }>
  ): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    const tolerance = 2;
    const isAccurate = Math.abs(predictionErrorDays) <= tolerance ? 1 : 0;
    const isOver = predictionErrorDays > tolerance ? 1 : 0;
    const isUnder = predictionErrorDays < -tolerance ? 1 : 0;

    for (const ctx of contexts) {
      const { data: existing } = await supabase
        .from('prediction_context_metrics')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('context_type', ctx.type)
        .eq('context_value', ctx.value)
        .maybeSingle();

      if (existing) {
        const n = existing.sample_size + 1;
        const newAccuracy = Math.round(((existing.historical_accuracy * existing.sample_size) + (isAccurate * 100)) / n);
        const newMeanError = ((existing.mean_error * existing.sample_size) + predictionErrorDays) / n;
        const newOverRate = Math.round(((existing.overconfidence_rate * existing.sample_size) + (isOver * 100)) / n);
        const newUnderRate = Math.round(((existing.underconfidence_rate * existing.sample_size) + (isUnder * 100)) / n);

        await supabase
          .from('prediction_context_metrics')
          .update({
            historical_accuracy: newAccuracy,
            mean_error: Math.round(newMeanError * 10) / 10,
            overconfidence_rate: newOverRate,
            underconfidence_rate: newUnderRate,
            sample_size: n
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('prediction_context_metrics')
          .insert({
            workspace_id: workspaceId,
            context_type: ctx.type,
            context_value: ctx.value,
            historical_accuracy: isAccurate * 100,
            mean_error: predictionErrorDays,
            overconfidence_rate: isOver * 100,
            underconfidence_rate: isUnder * 100,
            sample_size: 1
          });
      }
    }

    await activityLogService.appendLog({
      workspace_id: workspaceId,
      task_id: taskId,
      action_type: 'context_prediction_recorded',
      metadata: {
        context_count: contexts.length,
        contexts: contexts.map(c => `${c.type}:${c.value}`),
        prediction_error_days: predictionErrorDays,
        predicted_confidence: predictedConfidence
      }
    });

    return true;
  },

  async computeContextAccuracy(
    workspaceId: string,
    contextType?: ContextType
  ): Promise<ContextAccuracy[]> {
    if (!isSupabaseConfigured) return [];

    let query = supabase
      .from('prediction_context_metrics')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (contextType) query = query.eq('context_type', contextType);

    const { data, error } = await query.order('sample_size', { ascending: false });

    if (error || !data) return [];
    return data.map(r => ({
      context_type: r.context_type,
      context_value: r.context_value,
      historical_accuracy: r.historical_accuracy,
      mean_error: r.mean_error,
      overconfidence_rate: r.overconfidence_rate,
      underconfidence_rate: r.underconfidence_rate,
      sample_size: r.sample_size
    }));
  },

  async getContextAdjustment(
    workspaceId: string,
    rawConfidence: number,
    contexts: Array<{ type: ContextType; value: string }>
  ): Promise<{
    adjustedConfidence: number;
    adjustment: number;
    reason: string;
    contributingContexts: string[];
  }> {

    const global = await confidenceCalibrationService.getConfidenceAdjustment(workspaceId, rawConfidence);

    const allMetrics = await this.computeContextAccuracy(workspaceId);
    let totalWeight = 5;
    let weightedAdjustment = global.adjustment * totalWeight;

    const contributingContexts: string[] = [];

    for (const ctx of contexts) {
      const match = allMetrics.find(
        m => m.context_type === ctx.type && m.context_value === ctx.value
      );
      if (!match || match.sample_size < 2) continue;

      const contextPenalty = Math.min(match.mean_error * 3, 30);
      const weight = Math.sqrt(match.sample_size);
      totalWeight += weight;

      const bucket = getConfidenceBucket(rawConfidence);
      const bucketMatch = allMetrics.filter(m => m.context_type === ctx.type && m.context_value === ctx.value);
      const contextAdjustment = contextPenalty * weight;

      weightedAdjustment += contextAdjustment;
      contributingContexts.push(`${ctx.type}:${ctx.value}`);
    }

    const blendedPenalty = totalWeight > 0 ? Math.round(weightedAdjustment / totalWeight) : global.adjustment;
    const adjustedConfidence = Math.max(5, Math.min(99, Math.round(rawConfidence - blendedPenalty)));
    const finalAdjustment = rawConfidence - adjustedConfidence;

    const reason = contributingContexts.length > 0
      ? `Blended from global (${global.adjustment}pt) + ${contributingContexts.length} context(s)`
      : global.reason;

    await activityLogService.appendLog({
      workspace_id: workspaceId,
      action_type: 'context_adjustment_applied',
      metadata: {
        raw_confidence: rawConfidence,
        adjusted_confidence: adjustedConfidence,
        global_adjustment: global.adjustment,
        blended_adjustment: finalAdjustment,
        contributing_contexts: contributingContexts,
        context_count: contributingContexts.length
      }
    });

    return {
      adjustedConfidence,
      adjustment: finalAdjustment,
      reason,
      contributingContexts
    };
  }
};
