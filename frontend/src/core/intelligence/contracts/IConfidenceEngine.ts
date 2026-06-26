import type { FeatureVector } from '../rodm/FeatureVector';
import type { PredictionRecord } from '../types/prediction';

export interface IConfidenceEngine {
  calculateConfidence(prediction: PredictionRecord, vector: FeatureVector): Promise<Record<string, unknown>>;
}
