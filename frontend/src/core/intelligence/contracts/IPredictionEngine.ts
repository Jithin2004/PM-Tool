import type { FeatureVector } from '../rodm/FeatureVector';
import type { PredictionRecord } from '../types/prediction';

export interface IPredictionEngine {
  predict(entityType: string, entityId: string, vector: FeatureVector): Promise<PredictionRecord>;
}
