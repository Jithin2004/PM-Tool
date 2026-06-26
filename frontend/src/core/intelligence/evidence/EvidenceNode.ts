export type EvidenceNodeType = 
  | 'Prediction' | 'Forecast' | 'Feature' | 'MathematicalEngine' 
  | 'OperationalSnapshot' | 'FeatureSnapshot' | 'WaitState' 
  | 'Approval' | 'Meeting' | 'Dependency' | 'Milestone' 
  | 'Project' | 'Calendar' | 'Simulation' | 'Evaluation' 
  | 'Feedback' | 'Dataset';

export type TrustContribution = 'Positive' | 'Neutral' | 'Negative';

export interface EvidenceNode {
  id: string;
  type: EvidenceNodeType;
  source: string;
  timestamp: string;
  version: string;
  lineage: string[];
  confidence: number;
  trust_contribution: TrustContribution;
}
