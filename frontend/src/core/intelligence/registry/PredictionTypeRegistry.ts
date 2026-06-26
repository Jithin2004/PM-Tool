export interface PredictionTypeDefinition {
  type_id: string;
  description: string;
  required_features: string[];
}

export interface PredictionTypeRegistry {
  registerType(definition: PredictionTypeDefinition): Promise<void>;
  getType(typeId: string): Promise<PredictionTypeDefinition | null>;
}
