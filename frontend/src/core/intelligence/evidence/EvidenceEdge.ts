export type EvidenceEdgeType = 
  | 'generated_by' 
  | 'derived_from' 
  | 'validated_by' 
  | 'depends_on' 
  | 'calibrated_by' 
  | 'learned_from' 
  | 'replayed_by' 
  | 'evaluated_by';

export interface EvidenceEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type: EvidenceEdgeType;
  metadata?: Record<string, any>;
}
