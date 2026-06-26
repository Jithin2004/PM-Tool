export class IntelligenceCacheStrategy {
  private workspaceCache = new Map<string, any>();
  private projectCache = new Map<string, any>();
  private sprintCache = new Map<string, any>();
  private taskCache = new Map<string, any>();

  public getProjectIntelligence(projectId: string): any | null {
    return this.projectCache.get(projectId) || null;
  }

  public setProjectIntelligence(projectId: string, data: any): void {
    this.projectCache.set(projectId, data);
  }

  public invalidateProject(projectId: string): void {
    this.projectCache.delete(projectId);
    // Dependency-aware: invalidating a project should invalidate workspace aggregates
    this.workspaceCache.clear(); 
  }

  public invalidateTask(taskId: string, projectId: string): void {
    this.taskCache.delete(taskId);
    // Invalidating a task cascades to its parent project
    this.invalidateProject(projectId);
  }
}
