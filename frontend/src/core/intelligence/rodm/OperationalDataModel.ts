import type { FeatureVector } from './FeatureVector';

/**
 * The Resolve Operational Data Model (RODM).
 * This layer is the ONLY legal source of data for future prediction engines.
 * No engine may directly query operational tables.
 */
export interface OperationalDataModel {
  /**
   * Retrieves a normalized feature vector for a given entity at a specific point in time.
   */
  getFeatureVector(entityType: string, entityId: string, timestamp?: string): Promise<FeatureVector>;
  
  /**
   * Retrieves a batch of feature vectors for orchestration.
   */
  getFeatureVectors(entityType: string, entityIds: string[], timestamp?: string): Promise<FeatureVector[]>;
}
