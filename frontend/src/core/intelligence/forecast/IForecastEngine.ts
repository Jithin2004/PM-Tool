import type { ForecastEvidence, ForecastRecommendation } from './ForecastResult';

export interface ForecastEngineContext {
  mathematical_snapshot: any;
  orchestrator_state: Record<string, any>;
}

export interface SpecializedForecastOutput {
  predictions: Record<string, any>;
  evidence: ForecastEvidence[];
  recommendations: ForecastRecommendation[];
  explanations: Record<string, string>;
}

export interface IForecastEngine {
  engine_id: string;
  version: string;
  execute(context: ForecastEngineContext): SpecializedForecastOutput;
}
