export interface EngineScorecard {
  engine_id: string;
  engine_type: 'mathematical' | 'forecast';
  version: string;
  accuracy_percentage: number;
  usage_count: number;
  historical_successes: number;
  historical_failures: number;
  replay_count: number;
  validation_count: number;
}
