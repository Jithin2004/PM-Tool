import type { PredictionRecord } from '../types/prediction';

export interface IScenarioEngine {
  simulate(scenarioPayload: Record<string, unknown>): Promise<PredictionRecord[]>;
}
