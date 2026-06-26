export interface ForecastEvidence {
  id: string;
  source_entity: string;
  metric: string;
  value: any;
  originating_event: string;
  lineage_path: string[];
}

export interface ForecastRecommendation {
  id: string;
  action: string;
  target: string;
  expected_impact: string;
  evidence_references: string[];
}

export interface ConstitutionalConfidence {
  data_completeness_score: number;
  feature_quality_score: number;
  snapshot_freshness_score: number;
  historical_availability_score: number;
  prediction_horizon_penalty: number;
  overall_confidence: number;
}

export interface ForecastResult {
  forecast_id: string;
  forecast_version: string;
  forecast_timestamp: string;
  mathematical_snapshot_reference: string;
  algorithm_versions: Record<string, string>;
  engine_versions: Record<string, string>;
  predictions: Record<string, any>;
  confidence: ConstitutionalConfidence;
  quality: Record<string, number>;
  evidence: ForecastEvidence[];
  explanations: Record<string, string>;
  recommendations: ForecastRecommendation[];
}
