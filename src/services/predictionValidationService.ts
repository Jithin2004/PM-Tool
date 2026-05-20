import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Task } from '../types';
import { confidenceCalibrationService } from './confidenceCalibrationService';
import { contextPredictionService, inferTaskCategory, type ContextType } from './contextPredictionService';

export interface PredictionErrorRecord {
  workspace_id: string;
  task_id: string;
  task_name?: string;
  assignee_id?: string;
  predicted_completion: string;
  actual_completion: string;
  prediction_error_days: number;
  predicted_confidence?: number;
  confidence_error?: number;
  predicted_risk?: string;
  estimated_hours?: number;
  actual_hours?: number;
  pert_best?: number;
  pert_likely?: number;
  pert_worst?: number;
  delay_drift_days?: number;
}

export const predictionValidationService = {
  async recordCompletion(task: Task): Promise<boolean> {
    if (!isSupabaseConfigured || !task.predicted_completion) return false;

    const actualDate = new Date();
    const predictedDate = new Date(task.predicted_completion);
    const predictionErrorDays = Math.round(
      (actualDate.getTime() - predictedDate.getTime()) / 86400000
    );

    const record: PredictionErrorRecord = {
      workspace_id: task.workspace_id,
      task_id: task.id,
      task_name: task.name,
      assignee_id: task.assignee_id,
      predicted_completion: task.predicted_completion.split('T')[0],
      actual_completion: actualDate.toISOString().split('T')[0],
      prediction_error_days: predictionErrorDays,
      predicted_confidence: task.confidence,
      confidence_error: task.confidence != null ? 100 - task.confidence : undefined,
      predicted_risk: task.risk,
      estimated_hours: task.estimated_hours,
      pert_best: task.pert_best,
      pert_likely: task.pert_likely,
      pert_worst: task.pert_worst,
      delay_drift_days: task.delay_drift_days
    };

    const { error } = await supabase.from('prediction_errors').insert(record);
    if (error) {
      console.error('predictionValidationService.recordCompletion:', error);
      return false;
    }

    if (task.confidence != null) {
      await confidenceCalibrationService.recordOutcome(
        task.workspace_id,
        task.id,
        task.confidence,
        predictionErrorDays
      );

      const contexts: Array<{ type: ContextType; value: string }> = [
        { type: 'assignee', value: task.assignee_id || 'unassigned' },
        { type: 'task_category', value: inferTaskCategory(task.name, (task as any).tags) },
      ];

      try {
        const { data: project } = await supabase
          .from('projects')
          .select('execution_mode, template')
          .eq('id', task.project_id)
          .maybeSingle();

        if (project) {
          contexts.push({ type: 'execution_mode', value: (project as any).execution_mode || 'unknown' });
          contexts.push({ type: 'project_type', value: (project as any).template || 'unknown' });
        }
      } catch (e) {
        // project fetch non-critical
      }

      try {
        const { data: ws } = await supabase
          .from('workspace_settings')
          .select('businessType')
          .eq('id', task.workspace_id)
          .maybeSingle();

        if (ws && (ws as any).businessType) {
          contexts.push({ type: 'industry', value: (ws as any).businessType });
        }
      } catch (e) {
        // workspace fetch non-critical
      }

      await contextPredictionService.recordContextOutcome(
        task.workspace_id,
        task.id,
        task.confidence,
        predictionErrorDays,
        contexts
      );
    }

    return true;
  },

  async getWorkspaceStats(workspaceId: string): Promise<{
    mae: number;
    bias: number;
    sampleCount: number;
  } | null> {
    if (!isSupabaseConfigured) return null;

    const { data, error } = await supabase
      .from('prediction_errors')
      .select('prediction_error_days')
      .eq('workspace_id', workspaceId);

    if (error || !data || data.length === 0) return null;

    const absSum = data.reduce((s, r) => s + Math.abs(r.prediction_error_days), 0);
    const signedSum = data.reduce((s, r) => s + r.prediction_error_days, 0);
    return {
      mae: Math.round((absSum / data.length) * 10) / 10,
      bias: Math.round((signedSum / data.length) * 10) / 10,
      sampleCount: data.length
    };
  }
};
