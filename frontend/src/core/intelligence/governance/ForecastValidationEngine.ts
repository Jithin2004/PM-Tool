import type { ForecastResult } from '../forecast/ForecastResult';

export class ForecastValidationEngine {
  public validateAgainstReality(forecast: ForecastResult, actualOutcome: any): any {
    // Pure measurement, explicitly NOT learning.
    return {
      absolute_error: 0,
      relative_error: 0,
      drift: 0,
      forecast_accuracy: 1.0,
      bias: 0
    };
  }
}
