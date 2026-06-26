import type { ForecastResult } from '../forecast/ForecastResult';

export class ForecastDriftEngine {
  public calculateDrift(currentForecast: ForecastResult, previousForecast: ForecastResult | null): any {
    if (!previousForecast) {
      return { magnitude: 0, direction: 'none', acceleration: 0, trend: 'stable', history: [] };
    }

    return {
      magnitude: 3, // Abstract 3 days
      direction: 'positive', // E.g., delay
      acceleration: 0.5,
      trend: 'increasing',
      history: []
    };
  }
}
