export interface ProjectIntelligenceDTO {
  project_id: string;
  expected_completion_date: string;
  delay_drift_days: number;
  confidence_score: number;
  timeline_state: 'Stable' | 'Drifting' | 'Blocked';
  critical_path_summary: string[];
  risk_summary: string[];
  evidence_summary: string;
  recommendations: any[];
  forecast_version: string;
  snapshot_reference: string;
}

export interface MilestoneIntelligenceDTO {
  milestone_id: string;
  expected_completion_date: string;
  delay_drift_days: number;
  critical_path_contribution_percentage: number;
  delay_drivers: string[];
  remaining_working_hours: number;
  probability_distribution: { p10: string; p50: string; p90: string; };
  evidence_link: string;
}

export interface SprintIntelligenceDTO {
  sprint_id: string;
  expected_finish: string;
  velocity_trend: string;
  scope_volatility_percentage: number;
  blocked_time_hours: number;
  prediction_confidence: number;
}

export interface TaskIntelligenceDTO {
  task_id: string;
  predicted_finish: string;
  current_drift_hours: number;
  wait_time_contribution: number;
  forecast_confidence: number;
}

export interface ResourceIntelligenceDTO {
  user_id: string;
  current_capacity_percentage: number;
  future_capacity_percentage: number;
  predicted_burnout_risk: 'Low' | 'Medium' | 'High';
  estimation_bias: number;
}

export interface FinanceIntelligenceDTO {
  workspace_id: string;
  predicted_invoice_dates: string[];
  revenue_at_risk_usd: number;
  commercial_drift_usd: number;
  prediction_confidence: number;
}

export interface ExecutiveIntelligenceDTO {
  workspace_id: string;
  overall_intelligence_score: number;
  forecast_health: string;
  prediction_drift: number;
  prediction_stability: string;
}
