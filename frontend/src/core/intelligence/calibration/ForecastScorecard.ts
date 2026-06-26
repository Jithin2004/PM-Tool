export interface ForecastScorecard {
  forecast_id: string;
  forecast_accuracy_percentage: number;
  bias: number;
  mean_absolute_error: number;
  median_error: number;
  worst_error: number;
  best_error: number;
  forecast_reliability: number;
  forecast_stability: number;
  historical_rank: number;
}
