import type { ForecastResult, ForecastEvidence, ForecastRecommendation } from '../forecast/ForecastResult';

export interface GovernanceVersion {
  orchestrator_version: string;
  policy_engine_version: string;
  rule_engine_version: string;
}

export interface GovernedForecast {
  governance_id: string;
  forecast: ForecastResult;
  policy_results: any[];
  rule_results: any[];
  assumptions: any[];
  evidence: ForecastEvidence[];
  recommendations: ForecastRecommendation[];
  forecast_stability: any;
  forecast_drift: any;
  validation_metrics: any;
  governance_version: GovernanceVersion;
  history_reference: string;
  views: {
    pm_view: any;
    executive_view: any;
    finance_view: any;
    client_view: any;
    operations_view: any;
  };
  future_hooks: {
    monte_carlo_ready: boolean;
    bayesian_ready: boolean;
    learning_ready: boolean;
    calibration_ready: boolean;
    scenario_ready: boolean;
    optimization_ready: boolean;
    risk_simulator_ready: boolean;
    decision_optimizer_ready: boolean;
  };
}
