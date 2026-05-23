export interface Prediction {
  id: string;
  type: 'sprint_instability' | 'overload' | 'blocker_risk' | 'delay_risk' | 'dependency_escalation';
  probability: number;
  timeframe: string;
  title: string;
  description: string;
  context?: { projectId?: string; sprintId?: string; epicId?: string; userId?: string };
  timestamp: string;
}

export interface RiskForecast {
  domain: string;
  riskLevel: 'low' | 'moderate' | 'elevated' | 'high';
  probability: number;
  contributingFactors: string[];
}
