import type { CoordinationDensity, VitalityScore, Bottleneck } from '../coordination/types';
import type { AiInsight } from '../ai/types';
import type { Prediction } from '../prediction/types';
import type { WorkspaceMetrics } from '../state/types';

export interface EngineInput {
  coordination: {
    density: CoordinationDensity;
    vitality: VitalityScore;
    bottlenecks: Bottleneck[];
  };
  intelligence: {
    insights: AiInsight[];
    predictions: Prediction[];
  };
  state: {
    metrics: WorkspaceMetrics;
  };
}

export interface EngineOutput {
  timelineConfidence: number;
  sprintRiskLevel: 'low' | 'moderate' | 'elevated' | 'high';
  workloadBalance: 'balanced' | 'concentrated' | 'overloaded';
  forecastAccuracy: number;
  executionRisk: 'stable' | 'caution' | 'elevated' | 'critical';
}

export interface CrossEngineChannel {
  id: string;
  source: string;
  target: string;
  data: Partial<EngineInput>;
  timestamp: string;
}
