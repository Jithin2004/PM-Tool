export interface FeatureLineage {
  entity_type: string;
  entity_id: string;
  parent_lineage?: FeatureLineage;
}

export interface ExplainabilityMetadata {
  feature_id: string;
  provider: string;
  source: string;
  normalization_method: string | null;
  aggregation_method: string | null;
  generated_at: string;
  version: string;
  confidence: number;
  lineage: FeatureLineage;
}

export interface FeatureDefinition {
  id: string;
  source: string;
  normalization: string;
  version: string;
  lineage: string[];
}
