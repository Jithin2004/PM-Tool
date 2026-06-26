import type { ExplainabilityMetadata } from '../types/feature';

export interface FeatureValue {
  value: number | boolean | string;
  metadata: ExplainabilityMetadata;
}

export interface FeatureVector {
  vector_id: string;
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  timestamp: string;
  features: Record<string, FeatureValue>;
  version: string;
}
