import type { ProjectIntelligenceDTO } from './CanonicalIntelligenceDTOs';

// Transforms internal DTOs into exact UI contracts.
// UI components import this Adapter, completely shielding them from internal DTO evolution.

export class ProjectIntelligenceAdapter {
  public static toUIContract(dto: ProjectIntelligenceDTO): any {
    return {
      expected_completion_date: dto.expected_completion_date,
      confidence_score: dto.confidence_score,
      prediction_trend: dto.timeline_state === 'Stable' ? 'Stable' : 'Degrading',
      critical_drivers: dto.critical_path_summary,
      evidence_summary: dto.evidence_summary,
      forecast_stability: dto.timeline_state,
      forecast_version: dto.forecast_version,
      last_forecast_time: new Date().toISOString(),
      next_scheduled_forecast: 'Event Driven'
    };
  }
}
