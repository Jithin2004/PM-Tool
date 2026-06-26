import type { FeatureVector } from '../rodm/FeatureVector';

export interface IFeatureProvider {
  /**
   * Extracts raw operational data and normalizes it into a feature vector.
   */
  provideFeatures(entityId: string): Promise<FeatureVector>;
}
