export interface ExecutiveHealthContract {
  overall_intelligence_score: number;
  system_health_status: 'Healthy' | 'Degraded' | 'Failing';
}

export interface ForecastAccuracyContract {
  timeline_mae_days: number;
  cost_mape_percentage: number;
}

export interface ForecastReliabilityContract {
  stability_index: number;
  drift_variance: number;
}

export interface BusinessRiskContract {
  high_risk_projects_count: number;
  commercial_exposure_usd: number;
}

export interface CommercialForecastContract {
  projected_revenue_q4: number;
  delayed_billing_impact: number;
}

export interface ClientBehaviourContract {
  average_approval_latency_hours: number;
  revision_rate_percentage: number;
}

export interface PredictionTrustContract {
  evidence_coverage_percentage: number;
  calibration_error: number;
}

export interface LearningProgressContract {
  applied_rules_count: number;
  accuracy_improvement_percentage: number;
}
