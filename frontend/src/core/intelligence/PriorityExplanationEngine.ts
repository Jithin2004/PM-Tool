import { Task, Project, UserRole } from '../../types';

export interface PriorityExplanation {
  entityId: string;
  entityType: 'task' | 'approval' | 'blocker';
  priorityScore: number;
  reasons: string[];
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface PriorityExplanationContext {
  userId: string;
  role: UserRole;
  tasks: Task[];
  projects: Project[];
  blockers: any[];
  approvals: any[];
}

export function generatePriorityExplanation(
  entity: any,
  entityType: 'task' | 'approval' | 'blocker',
  context: PriorityExplanationContext
): PriorityExplanation {
  let score = 0;
  const reasons: string[] = [];
  const now = new Date();

  // Helper to add score and reason
  const addFactor = (pts: number, reason: string) => {
    score += pts;
    reasons.push(reason);
  };

  if (entityType === 'task') {
    const task = entity as Task;
    const project = context.projects.find(p => p.id === task.project_id);

    // Blocker ownership / Blocking someone
    const taskBlockers = context.blockers.filter(b => b.task_id === task.id && !b.resolved);
    if (taskBlockers.length > 0) {
      addFactor(50, 'Blocking teammates');
      
      const oldestBlocker = taskBlockers.reduce((oldest, b) => {
        const d = new Date(b.created_at || now);
        return d < oldest ? d : oldest;
      }, now);
      
      const waitingHours = (now.getTime() - oldestBlocker.getTime()) / (1000 * 60 * 60);
      if (waitingHours > 72) {
        addFactor(30, 'Critical wait time (>3 days)');
      } else if (waitingHours > 24) {
        addFactor(15, 'Extended wait time (>1 day)');
      }
    }

    // Overdue / Due today
    if (task.deadline) {
      const dueDate = new Date(task.deadline);
      dueDate.setHours(23, 59, 59, 999);
      const isOverdue = dueDate < now;
      const isDueToday = dueDate >= now && dueDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000;

      if (isOverdue) {
        addFactor(40, 'Overdue');
      } else if (isDueToday) {
        addFactor(40, 'Due today');
      } else if (dueDate.getTime() - now.getTime() < 3 * 24 * 60 * 60 * 1000) {
        addFactor(20, 'Due soon');
      }
    }

    // High priority on project/task
    if (task.priority === 'urgent') {
      addFactor(30, 'Urgent task priority');
    } else if (task.priority === 'high') {
      addFactor(20, 'High task priority');
    }
    
    if (project?.priority === 'high') {
      addFactor(20, 'High priority project');
    }

    // Recently assigned
    if (task.created_at) {
      const ageHours = (now.getTime() - new Date(task.created_at).getTime()) / (1000 * 60 * 60);
      if (ageHours < 24) {
        addFactor(10, 'Recently assigned');
      }
    }
  } else if (entityType === 'approval') {
    const approval = entity;
    if (approval.status === 'pending' && approval.requested_from === context.userId) {
      addFactor(35, 'Waiting for your response');
    }
    if (approval.created_at) {
      const ageHours = (now.getTime() - new Date(approval.created_at).getTime()) / (1000 * 60 * 60);
      if (ageHours > 48) {
        addFactor(20, 'Pending for over 48 hours');
      }
    }
  } else if (entityType === 'blocker') {
    const blocker = entity;
    if (!blocker.resolved) {
      addFactor(50, 'Unresolved blocker');
    }
    const task = context.tasks.find(t => t.id === blocker.task_id);
    if (task?.priority === 'urgent' || task?.priority === 'high') {
      addFactor(20, 'Blocking high-priority work');
    }
  }

  // Ensure at least one reason if score > 0
  if (score === 0) {
    reasons.push('Standard priority');
  }

  // Determine Impact Level
  let impactLevel: PriorityExplanation['impactLevel'] = 'low';
  if (score >= 90) {
    impactLevel = 'critical';
  } else if (score >= 50) {
    impactLevel = 'high';
  } else if (score >= 30) {
    impactLevel = 'medium';
  }

  return {
    entityId: entity.id,
    entityType,
    priorityScore: score,
    reasons,
    impactLevel
  };
}
