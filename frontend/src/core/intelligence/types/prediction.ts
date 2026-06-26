import type { PredictionLifecycle } from './lifecycle';

export interface PredictionRecord {
  prediction_id: string;
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  prediction_type: string;
  forecast_version: string;
  algorithm_version: string;
  feature_version: string;
  confidence_version: string;
  operational_snapshot_id: string;
  calendar_snapshot_id: string;
  knowledge_snapshot_id: string;
  commercial_snapshot_id: string;
  prediction_payload: Record<string, unknown>;
  confidence_payload: Record<string, unknown>;
  actual_outcome: Record<string, unknown> | null;
  prediction_error: number | null;
  lifecycle_status: PredictionLifecycle;
  created_at: string;
  validated_at: string | null;
}
