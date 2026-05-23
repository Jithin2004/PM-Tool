import type { OperationalIntent, OperationalPresence, CollaborationSignal } from '../presence/types';

export interface CoordinationDensity {
  totalActive: number;
  uniqueIntents: number;
  conflictScore: number;
  collaborationIntensity: 'low' | 'moderate' | 'high' | 'very_high';
  dominantIntent: OperationalIntent | 'none';
}

export interface OperationalPattern {
  id: string;
  type: 'coordination_burst' | 'review_gap' | 'blocker_cluster' | 'workload_concentration' | 'dependency_pressure' | 'sprint_stagnation' | 'redistribution';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  context: { projectId?: string; sprintId?: string; epicId?: string; taskId?: string; userId?: string };
  timestamp: string;
  metadata?: Record<string, number>;
}

export interface VitalityScore {
  overall: number;
  coordination: number;
  momentum: number;
  participation: number;
  stability: number;
  level: 'low' | 'moderate' | 'healthy' | 'strong';
}

export interface Bottleneck {
  id: string;
  type: 'blocker_concentration' | 'workload_imbalance' | 'review_bottleneck' | 'dependency_chain' | 'inactive_period' | 'excessive_reassignment';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  context: { projectId?: string; sprintId?: string; epicId?: string; userId?: string };
  impact: number;
  timestamp: string;
}

export interface ExecutionHotspot {
  id: string;
  label: string;
  intensity: number;
  type: 'sprint' | 'epic' | 'user' | 'dependency';
  description: string;
  context: { id: string; projectId?: string };
}

export interface CoordinationState {
  density: CoordinationDensity;
  patterns: OperationalPattern[];
  bottlenecks: Bottleneck[];
  hotspots: ExecutionHotspot[];
  vitality: VitalityScore;
}
