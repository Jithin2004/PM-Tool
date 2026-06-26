import type { FeatureVector } from '../rodm/FeatureVector';

export class FeatureNormalizer {
  /**
   * Converts raw operational values into standardized mathematical features.
   */
  public normalize(vector: FeatureVector): FeatureVector {
    const normalizedFeatures = { ...vector.features };

    for (const [key, feature] of Object.entries(normalizedFeatures)) {
      if (typeof feature.value === 'number' && key.includes('days')) {
        // Example: Normalize Calendar Days to Hours
        feature.value = feature.value * 24;
        feature.metadata.normalization_method = 'days_to_hours';
      }
    }

    return {
      ...vector,
      features: normalizedFeatures
    };
  }
}
