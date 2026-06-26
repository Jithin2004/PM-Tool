import type { PredictionRecord } from '../types/prediction';

export interface IExplainabilityEngine {
  explain(prediction: PredictionRecord): Promise<string>;
}
