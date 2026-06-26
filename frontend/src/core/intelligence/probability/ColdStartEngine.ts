export class ColdStartEngine {
  public determineBaselinePrior(workspaceHistoryCount: number, projectHistoryCount: number): string {
    if (workspaceHistoryCount === 0) {
      return 'industry_defaults';
    } else if (workspaceHistoryCount < 50) {
      return 'resolve_global_anonymous_baseline';
    } else if (projectHistoryCount < 10) {
      return 'workspace_history';
    } else {
      return 'project_team_developer_history';
    }
  }
}
