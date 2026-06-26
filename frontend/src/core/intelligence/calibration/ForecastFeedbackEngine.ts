import type { ForecastResult } from '../forecast/ForecastResult';

export interface ForecastFeedback {
  forecast_id: string;
  forecast_error: number;
  forecast_drift: number;
  completion_difference: number;
  commercial_difference: number;
  resource_difference: number;
}

export class ForecastFeedbackEngine {
  public evaluate(forecast: ForecastResult, actualReality: any): ForecastFeedback {
    // Abstract measurement of forecast against actual outcome
    return {
      forecast_id: forecast.forecast_id,
      forecast_error: 0,
      forecast_drift: 0,
      completion_difference: 0,
      commercial_difference: 0,
      resource_difference: 0
    };
  }
}
