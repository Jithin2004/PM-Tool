import type { VitalityScore } from '../coordination/types';

export interface AiInsight {
  id: string;
  type: 'coordination' | 'vitality' | 'risk' | 'pattern' | 'forecast';
  severity: 'info' | 'notice' | 'warning' | 'critical';
  title: string;
  description: string;
  context?: { projectId?: string; sprintId?: string; epicId?: string };
  timestamp: string;
}

export interface OperationalForecast {
  metric: string;
  direction: 'increasing' | 'stable' | 'declining' | 'volatile';
  confidence: number;
  timeframe: string;
  narrative: string;
}
