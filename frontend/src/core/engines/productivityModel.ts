import type { Task, ProductivityIndicators, WorkSession } from '../types/execution';

export const productivityModel = {
  /**
   * Calculates the Reliability Indicators for an employee based on their history.
   * This outputs qualitative language, NOT quantitative scores, to protect employee privacy
   * while helping PMs understand working patterns.
   */
  calculateIndicators(tasks: Task[], sessions: WorkSession[]): ProductivityIndicators {
    if (!tasks || tasks.length === 0) {
      return {
        insights: ['New to the workspace, gathering data.']
      };
    }

    const insights: string[] = [];
    const completedTasks = tasks.filter(t => t.status === 'completed');
    
    // 1. Delivery consistency
    if (completedTasks.length > 0) {
      const consistent = completedTasks.filter(t => {
        const est = t.estimated_effort_minutes || (t.estimated_hours * 60);
        if (!est) return true;
        const actual = t.actual_effort_minutes || ((t.work_time_hours || 0) * 60);
        return actual <= est * 1.2;
      }).length;
      
      const consistencyRate = consistent / completedTasks.length;
      if (consistencyRate > 0.8) {
        insights.push('Consistently delivers within estimated timelines.');
      } else if (consistencyRate < 0.5) {
        insights.push('Timeline uncertainty is increasing on assigned tasks.');
      }
    }

    // 2. Estimation Improvement Trend
    if (completedTasks.length > 5) {
      const sorted = [...completedTasks].sort((a, b) => new Date(a.completed_at || '').getTime() - new Date(b.completed_at || '').getTime());
      const early = sorted.slice(0, 3);
      const recent = sorted.slice(-3);
      
      const earlyAccuracy = early.reduce((acc, t) => acc + Math.abs((t.estimated_effort_minutes || 0) - (t.actual_effort_minutes || 0)), 0);
      const recentAccuracy = recent.reduce((acc, t) => acc + Math.abs((t.estimated_effort_minutes || 0) - (t.actual_effort_minutes || 0)), 0);
      
      if (recentAccuracy < earlyAccuracy * 0.8) {
        insights.push('Estimation accuracy is improving over time.');
      }
    }

    // 3. Learning Curve
    if (completedTasks.length < 5) {
      insights.push('Still adapting to project architecture (Learning curve active).');
    }

    if (insights.length === 0) {
      insights.push('Working steadily with predictable patterns.');
    }

    return { insights };
  }
};
