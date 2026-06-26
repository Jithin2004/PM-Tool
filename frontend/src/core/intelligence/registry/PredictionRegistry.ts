import type { PredictionRecord } from '../types/prediction';
import type { PredictionLifecycle } from '../types/lifecycle';

export interface PredictionRegistry {
  storePrediction(record: PredictionRecord): Promise<void>;
  getPrediction(predictionId: string): Promise<PredictionRecord | null>;
  updateLifecycle(predictionId: string, status: PredictionLifecycle): Promise<void>;
  queryPredictions(filters: Record<string, unknown>): Promise<PredictionRecord[]>;
}
