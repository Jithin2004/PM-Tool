import type { ForecastResult } from '../forecast/ForecastResult';

export class ForecastStabilityEngine {
  public calculateStability(currentForecast: ForecastResult, historicalForecasts: ForecastResult[]): string {
    if (historicalForecasts.length === 0) return 'Stable';
    
    // Abstract architecture for stability classification without ML.
    // E.g., 'Stable', 'Changing Slowly', 'Volatile', 'Highly Volatile'
    return 'Stable';
  }
}
