import type { FeatureVector } from '../rodm/FeatureVector';

export class FeatureValidator {
  /**
   * Detects invalid mathematical structures and rejects invalid vectors.
   */
  public validate(vector: FeatureVector): boolean {
    const keys = new Set<string>();

    for (const [key, feature] of Object.entries(vector.features)) {
      if (keys.has(key)) {
        throw new Error(`Duplicate feature id detected: ${key}`);
      }
      keys.add(key);

      if (feature.value === null || feature.value === undefined) {
        throw new Error(`Null required value detected for feature: ${key}`);
      }

      if (typeof feature.value === 'number') {
        if (Number.isNaN(feature.value)) {
          throw new Error(`NaN detected for feature: ${key}`);
        }
        if (!Number.isFinite(feature.value)) {
          throw new Error(`Infinity detected for feature: ${key}`);
        }
        if (key.includes('duration') && feature.value < 0) {
          throw new Error(`Negative duration detected for feature: ${key}`);
        }
      }

      if (!feature.metadata.lineage) {
        throw new Error(`Missing lineage for feature: ${key}`);
      }
    }

    if (!vector.timestamp || isNaN(Date.parse(vector.timestamp))) {
      throw new Error(`Invalid timestamp detected for vector: ${vector.vector_id}`);
    }

    return true;
  }
}
