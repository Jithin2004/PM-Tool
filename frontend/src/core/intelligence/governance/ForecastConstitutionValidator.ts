import type { ForecastResult } from '../forecast/ForecastResult';
import type { GovernedForecast } from './GovernedForecast';

export class ForecastConstitutionValidator {
  public static validate(forecast: GovernedForecast): void {
    if (!forecast.forecast.mathematical_snapshot_reference) {
      throw new Error("Unconstitutional: Forecast is missing mathematical snapshot reference.");
    }
    if (!forecast.forecast.engine_versions || Object.keys(forecast.forecast.engine_versions).length === 0) {
      throw new Error("Unconstitutional: Forecast is missing mathematical engine versions.");
    }
    for (const rec of forecast.recommendations) {
      if (!rec.evidence_references || rec.evidence_references.length === 0) {
        throw new Error(`Unconstitutional: Recommendation ${rec.id} is missing supporting evidence.`);
      }
    }
    for (const assumption of forecast.assumptions) {
      if (!assumption.supporting_evidence || assumption.supporting_evidence.length === 0) {
        throw new Error(`Unconstitutional: Assumption ${assumption.id} is missing supporting evidence.`);
      }
    }
    // Validation successful
  }
}
