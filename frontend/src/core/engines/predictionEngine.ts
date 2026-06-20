import type { Task, ProductivityIndicators } from '../types/execution';
import { intelligenceQueryEngine } from './intelligenceQueryEngine';

export interface TaskPrediction {
  minDays: number;
  maxDays: number;
  riskFactors: string[];
  explanation: string;
}

export const predictionEngine = {
  async predictCompletionRange(
    workspaceId: string,
    task: Task,
    leaves?: any[],
    holidays?: any[]
  ): Promise<TaskPrediction> {
    const currentEstHours = task.current_estimate || task.estimated_hours || (task.story_points ? task.story_points * 6 : 8);
    const baseDays = Math.max(1, currentEstHours / 8);

    const risks: string[] = [];
    const explanationParts: string[] = [];

    let leaveDays = 0;
    let holidayDays = 0;
    
    if (task.assignee_id && (leaves || holidays)) {
      const start = task.start_date ? new Date(task.start_date) : new Date();
      let currentDate = new Date(start);
      let workingDaysChecked = 0;
      let limitCount = 0;

      while (workingDaysChecked < Math.ceil(baseDays) && limitCount < 100) {
        limitCount++;
        const dateStr = currentDate.toISOString().split('T')[0];
        
        const isOnLeave = leaves?.some(l => {
          const lAssignee = l.assignee_id || l.user_id;
          if (lAssignee !== task.assignee_id) return false;
          const isLeaveType = l.event_type === 'leave' || l.type === 'leave';
          if (!isLeaveType) return false;
          const startD = new Date(l.start_date || l.start).toISOString().split('T')[0];
          const endD = new Date(l.end_date || l.end).toISOString().split('T')[0];
          return dateStr >= startD && dateStr <= endD;
        });

        const isHoliday = holidays?.some(h => {
          const isHolidayType = h.event_type === 'holiday' || h.type === 'holiday' || h.event_type === 'festival';
          const hDate = new Date(h.start_date || h.start || h.date).toISOString().split('T')[0];
          return isHolidayType && dateStr === hDate;
        });

        if (isOnLeave) leaveDays++;
        else if (isHoliday) holidayDays++;
        else {
          const dayOfWeek = currentDate.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) workingDaysChecked++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    if (leaveDays > 0) explanationParts.push(`Timeline shifted by ${leaveDays} days because assigned member is on leave`);
    if (holidayDays > 0) explanationParts.push(`Timeline shifted by ${holidayDays} days due to public holidays`);

    // Fetch real historical learning
    const learning = await intelligenceQueryEngine.getEstimateLearning(workspaceId, currentEstHours, task.assignee_id, task.project_id);
    if (learning.similarTasksCount > 0) {
      explanationParts.push(learning.insight);
    }

    if (task.status === 'blocked') {
      risks.push('Task is actively blocked');
      explanationParts.push('Task is currently blocked');
    }

    let multiplierMin = 1;
    let multiplierMax = 1;

    // Apply historical variance
    if (learning.similarTasksCount > 0) {
       // variance ratio: e.g. 1.2 means it takes 20% longer
       multiplierMax = Math.max(1, learning.averageVariance);
       multiplierMin = Math.min(1, learning.averageVariance);
    }

    const minDays = Math.max(1, Math.round((baseDays * multiplierMin + leaveDays + holidayDays) * 10) / 10);
    const maxDays = Math.max(minDays, Math.round((baseDays * multiplierMax + leaveDays + holidayDays) * 10) / 10);

    const explanation = `Because: ${explanationParts.join(', ')}`;

    return {
      minDays,
      maxDays,
      riskFactors: risks,
      explanation
    };
  },

  analyzeProjectRisk(tasks: Task[]): { alerts: string[] } {
    const alerts: string[] = [];
    const blockedTasks = tasks.filter(t => t.status === 'blocked');
    if (blockedTasks.length > 2) {
      alerts.push(`Multiple active blockers detected (${blockedTasks.length})`);
    }

    const driftingTasks = tasks.filter(t => t.delay_drift_days > 0 && t.status !== 'completed');
    if (driftingTasks.length > tasks.length * 0.2) {
      alerts.push('More than 20% of tasks are slipping');
    }

    return { alerts };
  }
};
