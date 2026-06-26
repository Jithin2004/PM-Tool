export interface FeatureSource {
  source_id: string;
  system: 'execution' | 'knowledge' | 'finance' | 'calendar';
  entity_type: string;
  refresh_frequency: string;
  reliability_score: number;
}
