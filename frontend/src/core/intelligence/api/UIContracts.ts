// Strict Data Contracts for the UI. No UI component performs calculations.

export interface ProjectIntelligenceProps {
  expected_completion_date: string;
  confidence_score: number;
  prediction_trend: 'Improving' | 'Stable' | 'Degrading';
  critical_drivers: string[];
  evidence_summary: string;
  forecast_stability: string;
  forecast_version: string;
  last_forecast_time: string;
  next_scheduled_forecast: string;
}

export interface MilestoneIntelligenceProps {
  expected_completion: string;
  current_drift_days: number;
  critical_path_contribution_percentage: number;
  delay_drivers: string[];
  remaining_working_hours: number;
  probability_distribution: { p10: string; p50: string; p90: string; };
  commercial_impact: string;
  evidence_link: string;
}

export interface SprintIntelligenceProps {
  expected_sprint_finish: string;
  velocity_trend: string;
  scope_volatility_percentage: number;
  reassignment_impact: string;
  blocked_time_hours: number;
  flow_efficiency_percentage: number;
  prediction_confidence: number;
  recommended_actions: any[];
}

export interface TaskIntelligenceProps {
  predicted_finish: string;
  current_drift_hours: number;
  wait_time_contribution: number;
  dependency_impact: string;
  resource_impact: string;
  forecast_confidence: number;
  evidence_graph_summary: string;
  explainability: string;
}

export interface ResourceIntelligenceProps {
  current_capacity_percentage: number;
  future_capacity_percentage: number;
  forecast_utilization: number;
  predicted_overload_hours: number;
  predicted_burnout_risk: 'Low' | 'Medium' | 'High';
  delivery_contribution_score: number;
  historical_accuracy_score: number;
  estimation_bias: number;
  learning_trend: string;
}

export interface ClientIntelligenceProps {
  average_approval_delay_hours: number;
  review_behaviour_classification: string;
  change_request_frequency: number;
  invoice_delay_behaviour: string;
  project_variance_impact: number;
  historical_delivery_impact: string;
}

export interface FinanceIntelligenceProps {
  predicted_invoice_dates: string[];
  revenue_at_risk_usd: number;
  cashflow_projection: any;
  commercial_drift_usd: number;
  delayed_billing_impact: string;
  delayed_collection_impact: string;
  prediction_confidence: number;
}

export interface ExecutiveCommandCenterProps {
  overall_intelligence_score: number;
  forecast_health: string;
  workspace_prediction_accuracy: number;
  prediction_drift: number;
  prediction_stability: string;
  confidence_distribution: any;
  business_risk: string;
  revenue_risk: string;
  delivery_risk: string;
  learning_progress: string;
}
