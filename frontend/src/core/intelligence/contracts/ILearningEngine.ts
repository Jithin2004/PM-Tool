import type { PredictionRecord } from '../types/prediction';

export interface ILearningEngine {
  validateOutcome(predictionId: string, actualOutcome: Record<string, unknown>): Promise<void>;
  measureError(prediction: PredictionRecord): Promise<number>;
}
