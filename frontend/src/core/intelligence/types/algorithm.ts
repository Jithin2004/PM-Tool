export interface AlgorithmDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  input_contract: Record<string, unknown>;
  output_contract: Record<string, unknown>;
  supported_prediction_types: string[];
}
