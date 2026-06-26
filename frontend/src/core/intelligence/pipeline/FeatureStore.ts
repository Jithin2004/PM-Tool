import type { FeatureVector } from '../rodm/FeatureVector';

/**
 * Storage-agnostic canonical interface representing validated feature vectors.
 */
export interface IFeatureStore {
  registerVector(vector: FeatureVector): Promise<void>;
  getVector(vectorId: string): Promise<FeatureVector | null>;
  queryVectors(entityType: string, entityId: string, version?: string): Promise<FeatureVector[]>;
}

export class FeatureStore implements IFeatureStore {
  // In-memory stub for architectural correctness
  private vectors: Map<string, FeatureVector> = new Map();

  public async registerVector(vector: FeatureVector): Promise<void> {
    this.vectors.set(vector.vector_id, vector);
  }

  public async getVector(vectorId: string): Promise<FeatureVector | null> {
    return this.vectors.get(vectorId) || null;
  }

  public async queryVectors(entityType: string, entityId: string, version?: string): Promise<FeatureVector[]> {
    return Array.from(this.vectors.values()).filter(v => 
      v.entity_type === entityType && 
      v.entity_id === entityId && 
      (!version || v.version === version)
    );
  }
}
