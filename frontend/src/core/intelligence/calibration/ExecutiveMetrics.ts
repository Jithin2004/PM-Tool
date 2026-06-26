export interface ExecutiveCalibrationMetrics {
  forecast_accuracy_percentage: number;
  average_forecast_drift: number;
  average_delay_error: number;
  commercial_accuracy: number;
  resource_accuracy: number;
  forecast_stability_index: number;
  engine_reliability_index: number;
  workspace_forecast_health: number;
}
