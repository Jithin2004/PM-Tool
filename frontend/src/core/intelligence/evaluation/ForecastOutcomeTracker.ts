export class ForecastOutcomeTracker {
  public trackOutcome(predictionId: string, predicted: any, actual: any): any {
    return {
      prediction_id: predictionId,
      eta_difference_ms: new Date(actual.eta).getTime() - new Date(predicted.eta).getTime(),
      cost_difference: actual.cost - predicted.cost,
      duration_difference: actual.duration - predicted.duration,
      resource_difference: actual.resource_usage - predicted.resource_usage,
      commercial_difference: actual.commercial_events_count - predicted.commercial_events_count,
      tracked_at: new Date().toISOString()
    };
  }
}
