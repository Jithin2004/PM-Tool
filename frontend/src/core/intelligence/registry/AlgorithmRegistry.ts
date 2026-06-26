import type { AlgorithmDefinition } from '../types/algorithm';

export interface AlgorithmRegistry {
  registerAlgorithm(definition: AlgorithmDefinition): Promise<void>;
  getAlgorithm(id: string, version?: string): Promise<AlgorithmDefinition | null>;
  listAlgorithms(predictionType?: string): Promise<AlgorithmDefinition[]>;
}
