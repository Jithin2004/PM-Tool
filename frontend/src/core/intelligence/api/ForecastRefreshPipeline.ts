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
      // 1. Invalidate affected cache
      this.cache.invalidateProject(event.projectId);
      
      // 2. Queue background recalculation
      this.triggerBackgroundRecalculation(event.projectId);
    }
  }

  private triggerBackgroundRecalculation(projectId: string): void {
    // Fire and forget recalculation without blocking main thread
    console.log(`Queuing background recalculation for project: ${projectId}`);
  }
}
