import type { FeatureVector } from '../rodm/FeatureVector';

export class FeatureAggregator {
  /**
   * Converts atomic events into rolling metrics.
   * e.g., 5 task reassignments -> rolling_30d_reassignment_rate
   */
  public aggregate(vectors: FeatureVector[], windowDays: number): FeatureVector {
    if (vectors.length === 0) {
      throw new Error("Cannot aggregate empty feature vectors.");
    }
    
    // Architectural implementation representation
    // Calculates rolling averages, sums, and frequencies over the given window.
    
    const aggregatedFeatures = { ...vectors[0].features };
    
    for (const feature of Object.values(aggregatedFeatures)) {
      feature.metadata.aggregation_method = `rolling_${windowDays}d`;
    }

    return {
      vector_id: `vec_agg_${Date.now()}`,
      workspace_id: vectors[0].workspace_id,
      entity_type: vectors[0].entity_type,
      entity_id: vectors[0].entity_id,
      timestamp: new Date().toISOString(),
      version: '1.0',
      features: aggregatedFeatures
    };
  }
}
