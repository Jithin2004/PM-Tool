export interface Normalization {
  method: 'working_hours_diff' | 'rolling_average' | 'boolean_flag' | 'ratio' | 'categorical';
  parameters: Record<string, unknown>;
}
