import { supabase } from '../lib/supabase';

export interface TimelineBaseline {
  id: string;
  workspace_id: string;
  project_id: string;
  name: string;
  description: string | null;
  snapshot: any;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export const timelineBaselineService = {
  /**
   * Captures the current state of tasks and milestones as a baseline snapshot
   */
  async createBaseline(
    workspaceId: string,
    projectId: string,
    name: string,
    description: string | null,
    snapshotData: any
  ): Promise<TimelineBaseline> {
    const { data, error } = await supabase
      .from('timeline_baselines')
      .insert({
        workspace_id: workspaceId,
        project_id: projectId,
        name,
        description,
        snapshot: snapshotData,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Retrieves all baselines for a project
   */
  async getBaselines(projectId: string): Promise<TimelineBaseline[]> {
    const { data, error } = await supabase
      .from('timeline_baselines')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Compares the current task dates against a specific baseline
   */
  compareBaseline(currentTasks: any[], baselineSnapshot: any): any[] {
    const driftReport: any[] = [];
    
    // Assuming baselineSnapshot stores a map of taskId -> { start_date, deadline }
    for (const task of currentTasks) {
      const bTask = baselineSnapshot[task.id];
      if (bTask) {
        const bEnd = bTask.deadline ? new Date(bTask.deadline).getTime() : 0;
        const cEnd = task.deadline ? new Date(task.deadline).getTime() : 0;
        
        if (bEnd > 0 && cEnd > 0) {
          const diffMs = cEnd - bEnd;
          const driftDays = Math.round(diffMs / 86400000);
          if (driftDays !== 0) {
            driftReport.push({
              taskId: task.id,
              taskName: task.name,
              driftDays,
              originalEnd: bTask.deadline,
              currentEnd: task.deadline
            });
          }
        }
      }
    }
    
    return driftReport;
  }
};
