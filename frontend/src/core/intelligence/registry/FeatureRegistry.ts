import type { FeatureDefinition } from '../types/feature';

export interface FeatureRegistry {
  registerFeature(definition: FeatureDefinition): Promise<void>;
  getFeature(id: string, version?: string): Promise<FeatureDefinition | null>;
  listFeatures(source?: string): Promise<FeatureDefinition[]>;
}
