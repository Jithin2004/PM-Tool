import type { ForecastResult } from '../forecast/ForecastResult';

export class ForecastHistoryEngine {
  private historyStore: Map<string, any[]> = new Map();

  public appendHistory(forecast: ForecastResult, governanceMetadata: any): string {
    const historyId = `hist_${forecast.forecast_id}_${Date.now()}`;
    
    const record = {
      history_id: historyId,
      forecast_version: forecast.forecast_version,
      mathematical_snapshot: forecast.mathematical_snapshot_reference,
      engine_versions: forecast.engine_versions,
      assumptions: governanceMetadata.assumptions,
      evidence: forecast.evidence,
      recommendations: forecast.recommendations,
      policy_evaluations: governanceMetadata.policies,
      timestamp: new Date().toISOString()
    };

    if (!this.historyStore.has(forecast.forecast_id)) {
      this.historyStore.set(forecast.forecast_id, []);
    }
    
    this.historyStore.get(forecast.forecast_id)!.push(record);
    return historyId;
  }

  public getHistory(forecastId: string): any[] {
    return this.historyStore.get(forecastId) || [];
  }
}
