import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';

export interface CalibrationMetrics {
  bucket: string;
  sampleCount: number;
  accuracyRate: number;
  overconfidenceRate: number;
  underconfidenceRate: number;
  meanError: number;
}

export const CALIBRATION_BUCKETS = ['50-60', '60-70', '70-80', '80-90', '90-100'];

export function getConfidenceBucket(confidence: number): string {
  if (confidence >= 90) return '90-100';
  if (confidence >= 80) return '80-90';
  if (confidence >= 70) return '70-80';
  if (confidence >= 60) return '60-70';
  return '50-60';
}

export const confidenceCalibrationService = {
  async recordOutcome(
    workspaceId: string,
    taskId: string,
    predictedConfidence: number,
    predictionErrorDays: number
  ): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    const bucket = getConfidenceBucket(predictedConfidence);
    const tolerance = 2;
    const confidenceError = predictionErrorDays > tolerance
      ? predictionErrorDays
      : predictionErrorDays < -tolerance
        ? predictionErrorDays
        : 0;

    const { error } = await supabase.from('prediction_confidence_metrics').insert({
      workspace_id: workspaceId,
      task_id: taskId,
      predicted_confidence: predictedConfidence,
      actual_error_days: predictionErrorDays,
      confidence_error: confidenceError,
      confidence_bucket: bucket,
    });

    if (error) {
      console.error('confidenceCalibrationService.recordOutcome:', error);
      return false;
    }

    await activityLogService.appendLog({
      workspace_id: workspaceId,
      task_id: taskId,
      action: 'prediction_recorded',
      metadata: {
        predicted_confidence: predictedConfidence,
        prediction_error_days: predictionErrorDays,
        confidence_error: confidenceError,
        bucket
      }
    });

    return true;
  },

  async computeCalibration(workspaceId: string): Promise<CalibrationMetrics[]> {
    if (!isSupabaseConfigured) return [];

    const { data, error } = await supabase
      .from('prediction_confidence_metrics')
      .select('confidence_bucket, confidence_error, actual_error_days')
      .eq('workspace_id', workspaceId);

    if (error || !data || data.length === 0) return [];

    const grouped: Record<string, typeof data> = {};
    for (const row of data) {
      const b = row.confidence_bucket;
      if (!grouped[b]) grouped[b] = [];
      grouped[b].push(row);
    }

    const results: CalibrationMetrics[] = [];
    for (const bucket of CALIBRATION_BUCKETS) {
      const rows = grouped[bucket] || [];
      if (rows.length === 0) continue;

      const accurate = rows.filter(r => Math.abs(r.confidence_error) <= 2).length;
      const overconfident = rows.filter(r => r.confidence_error > 2).length;
      const underconfident = rows.filter(r => r.confidence_error < -2).length;
      const meanError = rows.reduce((s, r) => s + r.confidence_error, 0) / rows.length;

      results.push({
        bucket,
        sampleCount: rows.length,
        accuracyRate: Math.round((accurate / rows.length) * 100),
        overconfidenceRate: Math.round((overconfident / rows.length) * 100),
        underconfidenceRate: Math.round((underconfident / rows.length) * 100),
        meanError: Math.round(meanError * 10) / 10
      });
    }

    return results;
  },

  async getConfidenceAdjustment(
    workspaceId: string,
    rawConfidence: number
  ): Promise<{ adjustedConfidence: number; rawConfidence: number; adjustment: number; reason: string }> {
    const bucket = getConfidenceBucket(rawConfidence);
    const metrics = await this.computeCalibration(workspaceId);
    const bucketMetrics = metrics.find(m => m.bucket === bucket);

    if (!bucketMetrics || bucketMetrics.sampleCount < 3) {
      return {
        adjustedConfidence: rawConfidence,
        rawConfidence,
        adjustment: 0,
        reason: 'Insufficient historical data'
      };
    }

    const penalty = Math.min(bucketMetrics.meanError * 3, 30);
    const adjustedConfidence = Math.max(5, Math.min(99, Math.round(rawConfidence - penalty)));

    await activityLogService.appendLog({
      workspace_id: workspaceId,
      action: 'confidence_calibrated',
      metadata: {
        raw_confidence: rawConfidence,
        adjusted_confidence: adjustedConfidence,
        adjustment: rawConfidence - adjustedConfidence,
        bucket,
        bucket_accuracy: bucketMetrics.accuracyRate,
        bucket_mean_error: bucketMetrics.meanError,
        reason: `${bucketMetrics.accuracyRate}% historical accuracy in ${bucket} bucket`
      }
    });

    return {
      adjustedConfidence,
      rawConfidence,
      adjustment: rawConfidence - adjustedConfidence,
      reason: `${bucketMetrics.accuracyRate}% historical accuracy in ${bucket} bucket${bucketMetrics.meanError > 0 ? ` (avg ${bucketMetrics.meanError}d overconfidence)` : ''}`
    };
  }
};
