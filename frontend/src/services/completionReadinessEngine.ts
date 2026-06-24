import { hasCapability } from '../core/auth/permissions';
import { Task, Milestone, Approval, Project } from '../types';
import { WaitState } from '../core/types/collaboration';

export type CompletionPolicyMode = 'flexible' | 'controlled' | 'strict' | 'enterprise';

export interface CompletionReadinessScore {
  score: number;
  classification: 'Healthy' | 'At Risk' | 'Not Ready';
  remediationList: string[];
  isBlocker: boolean; // Indicates if completion is explicitly blocked by policy
}

export interface ProjectSignoff {
  id: string;
  workspace_id: string;
  project_id: string;
  approver_id: string;
  role: string;
  notes?: string;
  created_at: string;
}

export const completionReadinessEngine = {
  evaluateReadiness(
    project: Project,
    policy: CompletionPolicyMode,
    tasks: Task[],
    milestones: Milestone[],
    waitStates: WaitState[],
    approvals: Approval[],
    signoffs: ProjectSignoff[]
  ): CompletionReadinessScore {
    
    const remediationList: string[] = [];
    let score = 100;
    
    // 1. Task Completion
    const openTasks = tasks.filter(t => t.status !== 'done');
    if (openTasks.length > 0) {
      remediationList.push(`${openTasks.length} tasks remain open`);
      score -= (openTasks.length * 5);
    }

    // 2. Milestone Completion
    const openMilestones = milestones.filter(m => m.status !== 'achieved');
    if (openMilestones.length > 0) {
      remediationList.push(`${openMilestones.length} milestones are incomplete`);
      score -= (openMilestones.length * 10);
    }

    // 3. Wait State Health
    const activeWaitStates = waitStates.filter(ws => ws.status === 'active');
    if (activeWaitStates.length > 0) {
      remediationList.push(`${activeWaitStates.length} active wait states exist`);
      score -= (activeWaitStates.length * 15);
    }

    // 4. Approval Health (Enterprise only)
    if (policy === 'enterprise') {
      const requiredPhases = ['technical', 'client', 'compliance'];
      const completedApprovals = approvals.filter(a => a.status === 'approved' && a.project_id === project.id);
      
      requiredPhases.forEach(phase => {
        if (!completedApprovals.some(a => a.phase === phase)) {
          remediationList.push(`Missing ${phase} approval`);
          score -= 10;
        }
      });

      if (signoffs.length === 0) {
        remediationList.push(`Project signoff has not been recorded`);
        score -= 20;
      }
    }

    // Determine if blocked based on policy
    let isBlocker = false;
    
    if (policy === 'strict') {
      if (openTasks.length > 0 || activeWaitStates.length > 0) {
        isBlocker = true;
      }
    } else if (policy === 'enterprise') {
      if (remediationList.length > 0) {
        isBlocker = true;
      }
    } // 'flexible' and 'controlled' never block, they only warn (remediation list).

    // Bound score
    score = Math.max(0, Math.min(100, score));

    // Determine classification
    let classification: 'Healthy' | 'At Risk' | 'Not Ready' = 'Healthy';
    if (score < 50 || isBlocker) {
      classification = 'Not Ready';
    } else if (score < 90) {
      classification = 'At Risk';
    }

    return {
      score,
      classification,
      remediationList,
      isBlocker
    };
  },

  validateCompletionAttempt(readiness: CompletionReadinessScore, policy: CompletionPolicyMode, userRole: string): { allowed: boolean, reason?: string } {
    if (hasCapability(userRole as any, 'project.update')) {
      return { allowed: true }; // Super Admin override
    }

    if (policy === 'flexible') return { allowed: true };
    if (policy === 'controlled') return { allowed: true }; // Only warnings provided in UI

    if (readiness.isBlocker) {
      return {
        allowed: false,
        reason: `Project cannot be completed under ${policy} policy because:\n` + readiness.remediationList.map(r => `* ${r}`).join('\n')
      };
    }

    return { allowed: true };
  }
};
