export interface ForecastAssumption {
  id: string;
  description: string;
  supporting_evidence: any[];
  confidence: number;
  source: string;
  created_at: string;
  version: string;
}

export class ForecastAssumptionRegistry {
  private assumptions = new Map<string, ForecastAssumption>();

  public registerAssumption(assumption: ForecastAssumption): void {
    this.assumptions.set(assumption.id, assumption);
  }

  public getAssumptionsForForecast(forecastId: string): ForecastAssumption[] {
    // In production, this would query by relational linkage. For architecture, return all.
    return Array.from(this.assumptions.values());
  }
}
