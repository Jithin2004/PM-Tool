import type { IntelligenceCacheStrategy } from './IntelligenceCacheStrategy';

export class IntelligenceCommandService {
  constructor(private cache: IntelligenceCacheStrategy) {}

  public async triggerForecastRefresh(projectId: string): Promise<void> {
    this.cache.invalidateProject(projectId);
    // Triggers orchestrator to rebuild snapshot and generate forecast
  }

  public async triggerMonteCarlo(predictionId: string): Promise<void> {
    // Commands probability layer
  }

  public async triggerEvaluation(workspaceId: string): Promise<void> {
    // Commands evaluation layer
  }

  public async invalidateCache(scope: string, id: string): Promise<void> {
    if (scope === 'project') this.cache.invalidateProject(id);
  }
}
