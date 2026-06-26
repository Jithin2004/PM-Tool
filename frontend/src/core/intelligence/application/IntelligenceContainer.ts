import { IntelligenceCacheStrategy } from './IntelligenceCacheStrategy';
import { IntelligenceQueryService } from './IntelligenceQueryService';
import { IntelligenceCommandService } from './IntelligenceCommandService';
import { IntelligenceApplicationService } from './IntelligenceApplicationService';

// 9. Dependency Injection Container
const cacheStrategy = new IntelligenceCacheStrategy();
const queryService = new IntelligenceQueryService(cacheStrategy);
const commandService = new IntelligenceCommandService(cacheStrategy);

export const IntelligenceApp = new IntelligenceApplicationService(queryService, commandService);

// 6. Event Integration (Application Bus Hook)
export class IntelligenceEventBus {
  public static onApplicationEvent(event: { type: string; payload: any }): void {
    const refreshEvents = [
      'TaskCreated', 'TaskUpdated', 'TaskCompleted', 'TaskDeleted',
      'DependencyChanged', 'WaitStateAdded', 'WaitStateResolved',
      'SprintStarted', 'SprintClosed', 'MilestoneUpdated',
      'ApprovalCompleted', 'InvoiceGenerated', 'PaymentReceived'
    ];

    if (refreshEvents.includes(event.type)) {
      if (event.payload.projectId) {
        // Publish into ForecastRefreshPipeline via CommandService
        IntelligenceApp.commands.triggerForecastRefresh(event.payload.projectId).catch(console.error);
      }
    }
  }
}
