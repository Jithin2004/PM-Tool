import { IntelligenceCache } from './IntelligenceCache';

export class ForecastRefreshPipeline {
  constructor(private cache: IntelligenceCache) {}

  public onOperationalEvent(event: any): void {
    // Event-driven refresh logic (no polling)
    const triggerEvents = [
      'TaskCompleted', 'TaskDelayed', 'WaitStateChanged', 
      'DependencyChanged', 'ResourceReallocated', 
      'CalendarUpdated', 'MilestoneShifted', 'ApprovalLatencyUpdated'
    ];

    if (triggerEvents.includes(event.type) && event.projectId) {
      // 1. Invalidate affected cache (cache is scoped per environment inherently, or should be. We invalidate regardless to clear stale data).
      this.cache.invalidateProject(event.projectId);
      
      // 2. Queue background recalculation ONLY for production
      // Phase C: Sandbox intelligence must NEVER enter Production Intelligence.
      if (event.environment === 'production') {
        this.triggerBackgroundRecalculation(event.projectId);
      } else {
        console.log(`[ForecastRefreshPipeline] Skipping background recalculation for non-production environment: ${event.environment}`);
      }
    }
  }

  private triggerBackgroundRecalculation(projectId: string): void {
    // Fire and forget recalculation without blocking main thread
    console.log(`Queuing background recalculation for project: ${projectId}`);
  }
}
