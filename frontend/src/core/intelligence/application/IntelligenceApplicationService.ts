import type { IntelligenceQueryService } from './IntelligenceQueryService';
import type { IntelligenceCommandService } from './IntelligenceCommandService';

export class IntelligenceApplicationService {
  // Single public orchestration entrypoint
  constructor(
    private queryService: IntelligenceQueryService,
    private commandService: IntelligenceCommandService
  ) {}

  public get queries(): IntelligenceQueryService {
    return this.queryService;
  }

  public get commands(): IntelligenceCommandService {
    return this.commandService;
  }
}
