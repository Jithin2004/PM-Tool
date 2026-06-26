import type { IntelligenceCacheStrategy } from './IntelligenceCacheStrategy';
import type { 
  ProjectIntelligenceDTO, MilestoneIntelligenceDTO, SprintIntelligenceDTO, 
  TaskIntelligenceDTO, ResourceIntelligenceDTO, FinanceIntelligenceDTO, ExecutiveIntelligenceDTO 
} from './CanonicalIntelligenceDTOs';

export class IntelligenceQueryService {
  constructor(private cache: IntelligenceCacheStrategy) {}

  public async loadProjectIntelligence(projectId: string): Promise<ProjectIntelligenceDTO> {
    const cached = this.cache.getProjectIntelligence(projectId);
    if (cached) return cached;
    // Query never calculates, just orchestrates loading from persistence via Gateway/Replay
    throw new Error('Not implemented: requires persistence gateway bindings');
  }

  public async loadTaskIntelligence(taskId: string): Promise<TaskIntelligenceDTO> {
    throw new Error('Not implemented');
  }

  public async loadExecutiveIntelligence(workspaceId: string): Promise<ExecutiveIntelligenceDTO> {
    throw new Error('Not implemented');
  }
}
