import type { Task, ProductivityIndicators } from '../types/execution';

export interface TaskPrediction {
  minDays: number;
  maxDays: number;
  confidenceScore: number; // 0-100
  riskFactors: string[];
  explanation: string;
}

export const predictionEngine = {
  /**
   * Predicts the completion timeline of a task factoring in:
   * 1. The task's raw estimates and complexity
   * 2. The employee's historical Reliability Indicators
   * 3. Current discovery/confidence mode status
   */
  predictCompletionRange(
    task: Task,
    employeeIndicators: ProductivityIndicators,
    leaves?: any[],
    holidays?: any[]
  ): TaskPrediction {
    // Sprint 6.5: Use current_estimate (discovery-adjusted) as the base when available,
    // falling back to original_estimate, then estimated_hours, then story points.
    const currentEstHours = task.current_estimate || task.estimated_hours || (task.story_points ? task.story_points * 6 : 8);
    const originalEstHours = task.original_estimate || task.estimated_hours || currentEstHours;
    const baseDays = Math.max(1, currentEstHours / 8);

    let multiplierMin = 0.9;
    let multiplierMax = 1.2;
    const risks: string[] = [];
    const explanationParts: string[] = [];

    // Sprint 6.6: Factor in approved leave and public holidays
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
        
        // Check if assignee has approved leave on this date
        const isOnLeave = leaves?.some(l => {
          const lAssignee = l.assignee_id || l.user_id;
          if (lAssignee !== task.assignee_id) return false;
          const isLeaveType = l.event_type === 'leave' || l.type === 'leave';
          if (!isLeaveType) return false;
          
          const startD = new Date(l.start_date || l.start).toISOString().split('T')[0];
          const endD = new Date(l.end_date || l.end).toISOString().split('T')[0];
          return dateStr >= startD && dateStr <= endD;
        });

        // Check if date is a holiday
        const isHoliday = holidays?.some(h => {
          const isHolidayType = h.event_type === 'holiday' || h.type === 'holiday' || h.event_type === 'festival';
          const hDate = new Date(h.start_date || h.start || h.date).toISOString().split('T')[0];
          return isHolidayType && dateStr === hDate;
        });

        if (isOnLeave) {
          leaveDays++;
        } else if (isHoliday) {
          holidayDays++;
        } else {
          workingDaysChecked++;
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    if (leaveDays > 0) {
      explanationParts.push(`Timeline shifted by ${leaveDays} days because assigned member is unavailable`);
    }
    if (holidayDays > 0) {
      explanationParts.push(`Timeline shifted by ${holidayDays} days due to public holidays`);
    }

    // Sprint 6.5: Estimation Learning — compare original vs current constructively
    if (originalEstHours > 0 && currentEstHours !== originalEstHours) {
      const estimateRatio = currentEstHours / originalEstHours;
      if (estimateRatio > 1.3) {
        // Significant upward revision — complexity was underestimated
        explanationParts.push('Requirement complexity increased after discovery — estimate revised upward');
        // The current_estimate already reflects the new reality, so we slightly
        // tighten the range instead of expanding it (the developer already adapted).
        multiplierMax *= 0.95;
      } else if (estimateRatio < 0.7) {
        // Significant downward revision — task was simpler than expected
        explanationParts.push('Task scope clarified — estimate reduced after analysis');
      } else if (estimateRatio > 1.0) {
        explanationParts.push('Minor estimate adjustment after requirements refinement');
      }
    }

    // Factor in Insights (Qualitative)
    if (employeeIndicators.insights.some(i => i.includes('Learning curve active'))) {
      multiplierMin *= 1.1;
      multiplierMax *= 1.3;
      explanationParts.push('Employee is still adapting to project architecture');
    }

    if (employeeIndicators.insights.some(i => i.includes('Timeline uncertainty'))) {
      multiplierMax += 0.3;
      risks.push('Historical delivery inconsistency detected');
      explanationParts.push('Historical timeline uncertainty');
    } else {
      explanationParts.push('Consistent historical delivery');
    }

    // Factor in Task Confidence / Discovery Mode
    let confidenceScore = task.confidence || 80;
    if (task.discovery_notes && task.discovery_notes.length > 0) {
      multiplierMax += 0.5;
      confidenceScore -= 30;
      risks.push('Active discovery mode (high uncertainty)');
      explanationParts.push('Task is in active discovery mode');
    }

    // Factor in Blockers
    if (task.status === 'blocked') {
      multiplierMax += 1.0;
      confidenceScore -= 40;
      risks.push('Task is actively blocked');
      explanationParts.push('Task is currently blocked');
    } else {
      explanationParts.push('No active blockers');
    }

    const minDays = Math.max(1, Math.round((baseDays * multiplierMin + leaveDays + holidayDays) * 10) / 10);
    const maxDays = Math.max(minDays, Math.round((baseDays * multiplierMax + leaveDays + holidayDays) * 10) / 10);

    const explanation = `Because: ${explanationParts.join(', ')}`;

    return {
      minDays,
      maxDays,
      confidenceScore: Math.max(0, Math.min(100, confidenceScore)),
      riskFactors: risks,
      explanation
    };
  },

  /**
   * Project Risk Engine logic. Analyzes a project's tasks to output overall risk.
   */
  analyzeProjectRisk(tasks: Task[]): { riskScore: number; alerts: string[] } {
    let riskScore = 0;
    const alerts: string[] = [];
    
    const blockedTasks = tasks.filter(t => t.status === 'blocked');
    if (blockedTasks.length > 2) {
      riskScore += 30;
      alerts.push('Multiple active blockers detected');
    }

    const driftingTasks = tasks.filter(t => t.delay_drift_days > 0 && t.status !== 'completed');
    if (driftingTasks.length > tasks.length * 0.2) {
      riskScore += 40;
      alerts.push('More than 20% of tasks are slipping');
    }

    // Sprint 6.5: Estimation drift detection
    const tasksWithEstimates = tasks.filter(t => t.original_estimate && t.current_estimate && t.original_estimate > 0);
    if (tasksWithEstimates.length > 0) {
      const significantRevisions = tasksWithEstimates.filter(t => {
        const ratio = (t.current_estimate || 0) / (t.original_estimate || 1);
        return ratio > 1.3 || ratio < 0.7;
      });
      if (significantRevisions.length > tasksWithEstimates.length * 0.3) {
        riskScore += 15;
        alerts.push('Scope discovery ongoing — over 30% of tasks have revised estimates');
      }
    }

    if (riskScore >= 60) {
      alerts.unshift('Project delivery risk increased');
    }

    return { riskScore: Math.min(100, riskScore), alerts };
  }
};
