import { Project, Task, Team, Profile } from '../../types';
import { hasCapability } from '../auth/permissions';
import { buildExplanation } from './DecisionExplanationBuilder';
import { calculateDecisionConfidence } from './DecisionConfidenceEngine';

export type DecisionSeverity = 'critical' | 'warning' | 'info';
export type DecisionCategory = 'delivery_risk' | 'dependency_risk' | 'estimation_failure' | 'team_overload' | 'team_underutilized' | 'revenue_risk' | 'hr_risk';

export type ActionType = 
  | 'TASK_REASSIGNMENT'
  | 'CAPACITY_REBALANCE'
  | 'DEADLINE_ADJUSTMENT'
  | 'BLOCKER_ESCALATION'
  | 'RESOURCE_REQUEST'
  | 'SPRINT_RESCOPE'
  | 'APPROVAL_REQUIRED';

export interface ExpectedImpact {
  time_saved_hours?: number;
  delivery_probability_change?: number;
  workload_balance_change?: number;
  risk_reduction?: string;
  financial_impact?: number;
}

export interface DecisionInsight {
  id: string;
  severity: DecisionSeverity;
  category: DecisionCategory;
  title: string;
  cause: string[];
  recommendation: string;
  reasoning?: string;
  whyNow?: string;
  whyThisFix?: string;
  whatIfIgnored?: string;
  confidenceExplanation?: string;
  expectedImpactText: string;
  confidence: number;
  actionRoute?: string;
  actionLabel?: string;
  
  // Phase 2: Actionable Recommendation Engine Fields
  actionType?: ActionType;
  actionPayload?: Record<string, any>;
  expectedImpactMetrics?: ExpectedImpact;
}

export interface DecisionEngineInputs {
  userId: string;
  role: string;
  projects: Project[];
  tasks: Task[];
  teams: Team[];
  profiles: Profile[];
  workspaceSettingsBlob: any;
  invoices?: any[];
  contracts?: any[];
  leaves?: any[];
  attendance?: any[];
}

export function generateDecisionInsights(inputs: DecisionEngineInputs): DecisionInsight[] {
  const { userId, role, projects, tasks, profiles, workspaceSettingsBlob, invoices = [], contracts = [], leaves = [] } = inputs;
  const insights: DecisionInsight[] = [];

  const isSuperAdmin = hasCapability(role as any, 'workspace.update');
  const isPM = hasCapability(role as any, 'project.update') && !isSuperAdmin;
  const isDeveloper = hasCapability(role as any, 'task.update') && !hasCapability(role as any, 'project.update');
  const isFinance = hasCapability(role as any, 'finance.manage') && !isSuperAdmin;
  const isHR = hasCapability(role as any, 'people.manage') && !isSuperAdmin;
  
  const executionBlockers = workspaceSettingsBlob?.execution_blockers || [];

  // ==========================================
  // PHASE 2: PROJECT FAILURE PREDICTION (PM, SuperAdmin)
  // ==========================================
  if (isSuperAdmin || isPM) {
    projects.forEach(project => {
      if (project.status === 'archived' || project.status === 'deployed') return;
      
      const pTasks = tasks.filter(t => t.project_id === project.id);
      if (pTasks.length === 0) return;

      // 1. Estimation Failure
      let totalEstimated = 0;
      let totalActual = 0;
      let blowoutCount = 0;
      
      pTasks.forEach((t: any) => {
        totalEstimated += t.estimated_hours || 0;
        totalActual += t.actual_hours || 0;
        if (t.actual_hours > (t.estimated_hours * 1.5)) blowoutCount++;
      });

      if (totalActual > totalEstimated && totalEstimated > 0 && blowoutCount > 0) {
        const excess = totalActual - totalEstimated;
        
        const conf = calculateDecisionConfidence('estimation_failure', { tasks: pTasks, profiles });
        const expl = buildExplanation('estimation_failure', {}, { project, metrics: { excessHours: excess } });

        insights.push({
          id: `est-fail-${project.id}`,
          severity: 'warning',
          category: 'estimation_failure',
          title: `Estimation drift affecting ${project.name}`,
          cause: [
            `${blowoutCount} tasks exceeded estimates by >50%`,
            `Total actual hours (${totalActual}) exceeds planned (${totalEstimated})`
          ],
          recommendation: 'Conduct estimation calibration for upcoming sprints.',
          whyNow: expl.whyNow,
          whyThisFix: expl.whyThisFix,
          whatIfIgnored: expl.whatIfIgnored,
          expectedImpactText: `Mitigate ${excess} hours of unbudgeted work`,
          confidence: conf.score,
          confidenceExplanation: conf.explanation,
          actionRoute: `/workspace/portfolio`,
          actionLabel: 'Review Scope'
        });
      }

      // 2. Dependency Risk
      const pBlockers = executionBlockers.filter((b: any) => !b.resolved && pTasks.some((pt: any) => pt.id === b.task_id));
      if (pBlockers.length >= 2) {
        const conf = calculateDecisionConfidence('dependency_risk', { tasks: pTasks, profiles });
        const expl = buildExplanation('dependency_risk', {}, { project, metrics: { blockerCount: pBlockers.length } });

        insights.push({
          id: `dep-risk-${project.id}`,
          severity: 'critical',
          category: 'dependency_risk',
          title: `${project.name} blocked by cascading dependencies`,
          cause: [
            `${pBlockers.length} unresolved execution blockers`,
            `Wait-state latency increasing delivery risk`
          ],
          recommendation: 'Trigger immediate blocker coordination meeting.',
          reasoning: 'Unresolved dependencies are cascading. Immediate escalation prevents complete stream stall.',
          whyNow: expl.whyNow,
          whyThisFix: expl.whyThisFix,
          whatIfIgnored: expl.whatIfIgnored,
          expectedImpactText: 'Prevent complete stream stall',
          confidence: conf.score,
          confidenceExplanation: conf.explanation,
          actionRoute: '/execution/board',
          actionLabel: 'Clear Blockers',
          actionType: 'BLOCKER_ESCALATION',
          actionPayload: { project_id: project.id, blocker_ids: pBlockers.map((b: any) => b.id) },
          expectedImpactMetrics: { risk_reduction: 'High' }
        });
      }

      // 3. Schedule Risk
      const highRisk = pTasks.filter(t => t.status !== 'done' && (t as any).risk === 'high');
      if (highRisk.length > 0) {
        const conf = calculateDecisionConfidence('delivery_risk', { tasks: pTasks, profiles });
        const expl = buildExplanation('delivery_risk', {}, { project, metrics: {} });

        insights.push({
          id: `sched-risk-${project.id}`,
          severity: 'critical',
          category: 'delivery_risk',
          title: `${project.name} likely delayed by operational risk`,
          cause: highRisk.map(t => `${t.name} flagged as HIGH RISK`),
          recommendation: 'Reassign critical path tasks to unblocked operators.',
          reasoning: 'Critical tasks are blocked. Adding resources or shifting deadlines can recover the schedule.',
          whyNow: expl.whyNow,
          whyThisFix: expl.whyThisFix,
          whatIfIgnored: expl.whatIfIgnored,
          expectedImpactText: 'Stabilize delivery timeline',
          confidence: conf.score,
          confidenceExplanation: conf.explanation,
          actionRoute: '/execution/board',
          actionLabel: 'Reassign Work',
          actionType: 'DEADLINE_ADJUSTMENT',
          actionPayload: { project_id: project.id, target_tasks: highRisk.map(t => t.id) },
          expectedImpactMetrics: { delivery_probability_change: 25 }
        });
      }
    });
  }

  // ==========================================
  // PHASE 3: TEAM INTELLIGENCE (PM, SuperAdmin, HR)
  // ==========================================
  if (isSuperAdmin || isPM || isHR) {
    profiles.forEach(user => {
      const uTasks = tasks.filter(t => t.assignee_id === user.id && t.status !== 'done');
      const assignedHours = uTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
      const capacity = 40 * (user.availability_factor || 1.0);

      if (assignedHours > capacity * 1.2) {
        // Find matching developer
        const matchingAvailableDevs = profiles.filter(p => {
          if (p.id === user.id) return false;
          if (p.department && user.department && p.department !== user.department) return false;
          const pTasks = tasks.filter(t => t.assignee_id === p.id && t.status !== 'done');
          const pAssignedHours = pTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
          const pCapacity = 40 * (p.availability_factor || 1.0);
          return pAssignedHours < pCapacity * 0.8; // Has at least 20% free capacity
        });
        
        let recommendationText = `Transfer tasks to underutilized team members.`;
        let reasoningText = 'Overload guarantees burnout and schedule slips.';
        let targetDevId = null;
        let matchMetrics: any = {};
        
        if (matchingAvailableDevs.length > 0) {
          const match = matchingAvailableDevs[0];
          const matchTasks = tasks.filter(t => t.assignee_id === match.id && t.status !== 'done');
          const matchAssignedHours = matchTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
          const matchCapacity = 40 * (match.availability_factor || 1.0);
          const freeHours = Math.round(matchCapacity - matchAssignedHours);

          recommendationText = `Reassign non-critical tasks to ${match.full_name || match.email}.`;
          reasoningText = `${match.full_name || match.email} has matching department/designation and available capacity.`;
          targetDevId = match.id;
          matchMetrics.freeHours = freeHours;
        }

        const conf = calculateDecisionConfidence('team_overload', { tasks: uTasks, profiles, targetUserId: targetDevId || undefined });
        const expl = buildExplanation('team_overload', {}, { targetUser: targetDevId ? matchingAvailableDevs[0] : null, metrics: matchMetrics });
      
        insights.push({
          id: `overload-${user.id}`,
          severity: 'warning',
          category: 'team_overload',
          title: `${user.full_name || 'Operator'} is critically overloaded`,
          cause: [
            `Assigned ${assignedHours} hours against ${capacity} hour capacity`,
            `Utilization at ${Math.round((assignedHours / capacity) * 100)}%`
          ],
          recommendation: recommendationText,
          reasoning: reasoningText,
          whyNow: expl.whyNow,
          whyThisFix: expl.whyThisFix,
          whatIfIgnored: expl.whatIfIgnored,
          expectedImpactText: 'Prevent burnout and execution failure',
          confidence: conf.score,
          confidenceExplanation: conf.explanation,
          actionRoute: '/resources/capacity',
          actionLabel: 'Rebalance Work',
          actionType: 'TASK_REASSIGNMENT',
          actionPayload: { source_user_id: user.id, target_user_id: targetDevId, tasks: uTasks.slice(0, 2).map(t => t.id) },
          expectedImpactMetrics: { workload_balance_change: Math.min(100, Math.round(((assignedHours - capacity) / capacity) * 100)) }
        });
      } else if (assignedHours < capacity * 0.5 && hasCapability((user as any).role, 'task.update')) {
        insights.push({
          id: `underutil-${user.id}`,
          severity: 'info',
          category: 'team_underutilized',
          title: `${user.full_name || 'Operator'} has available capacity`,
          cause: [
            `Only assigned ${assignedHours} hours against ${capacity} hour capacity`
          ],
          recommendation: `Assign backlog items or cross-train on blocked tracks.`,
          expectedImpactText: `Accelerate delivery by ${Math.round(capacity - assignedHours)} hours`,
          confidence: 80,
          actionRoute: '/resources/capacity',
          actionLabel: 'Assign Work'
        });
      }
    });
  }

  // ==========================================
  // PHASE 4: FINANCE INTELLIGENCE (Finance, SuperAdmin)
  // ==========================================
  if (isFinance || isSuperAdmin) {
    const overdueInvoices = invoices.filter(i => i.status === 'overdue' || (i.status === 'sent' && i.due_date && new Date(i.due_date) < new Date()));
    
    if (overdueInvoices.length > 0) {
      const totalAmount = overdueInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
      insights.push({
        id: `fin-overdue`,
        severity: 'critical',
        category: 'revenue_risk',
        title: `$${totalAmount.toLocaleString()} payment delay affecting cashflow`,
        cause: overdueInvoices.map(i => `Invoice ${i.invoice_number || i.id} is overdue by terms`),
        recommendation: 'Initiate collection protocols and block further deliverables.',
        expectedImpactText: 'Recover stalled revenue',
        confidence: 100, // deterministic
        actionRoute: '/resources/finance',
        actionLabel: 'View Collections'
      });
    }

    const unbilledProjects = projects.filter(p => p.status === 'deployed' && !invoices.some(i => i.project_id === p.id));
    if (unbilledProjects.length > 0) {
      insights.push({
        id: `fin-unbilled`,
        severity: 'warning',
        category: 'revenue_risk',
        title: `${unbilledProjects.length} finalized projects lacking invoices`,
        cause: unbilledProjects.map(p => `${p.name} deployed but not billed`),
        recommendation: 'Generate client invoices immediately.',
        expectedImpactText: 'Accelerate cash conversion cycle',
        confidence: 95,
        actionRoute: '/resources/finance',
        actionLabel: 'Generate Invoices'
      });
    }
  }

  // ==========================================
  // PHASE 5: HR INTELLIGENCE (HR, SuperAdmin)
  // ==========================================
  if (isHR || isSuperAdmin) {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    
    const expiringContracts = contracts.filter(c => c.contract_end && new Date(c.contract_end) <= thirtyDaysFromNow && new Date(c.contract_end) >= now);
    
    expiringContracts.forEach(contract => {
      const activeUserTasks = tasks.filter(t => t.assignee_id === contract.user_id && t.status !== 'done');
      if (activeUserTasks.length > 0) {
        insights.push({
          id: `hr-contract-${contract.id}`,
          severity: 'critical',
          category: 'hr_risk',
          title: `Operator contract expires while holding ${activeUserTasks.length} active tasks`,
          cause: [
            `Contract ends on ${new Date(contract.contract_end).toLocaleDateString()}`,
            `Operator owns tasks across critical path`
          ],
          recommendation: 'Begin handover process or renew contract immediately.',
          expectedImpactText: 'Prevent silent knowledge loss and blocked dependencies',
          confidence: 100, // deterministic
          actionRoute: '/resources/teams',
          actionLabel: 'Manage Handover'
        });
      }
    });

    const pendingLeaves = leaves.filter(l => l.status === 'pending');
    if (pendingLeaves.length > 0) {
      insights.push({
        id: 'hr-leaves-risk',
        severity: 'warning',
        category: 'hr_risk',
        title: `${pendingLeaves.length} pending time-off requests`,
        cause: [ 'Unapproved leaves create blind spots in capacity planning' ],
        recommendation: 'Review requests against project milestones.',
        expectedImpactText: 'Ensure accurate sprint allocation',
        confidence: 100,
        actionRoute: '/resources/capacity',
        actionLabel: 'Review Leaves'
      });
    }
  }

  // ==========================================
  // PHASE 6: DEVELOPER EXECUTION BRAIN
  // ==========================================
  if (isDeveloper) {
    const myTasks = tasks.filter(t => t.assignee_id === userId && t.status !== 'done');
    const myBlockedIds = executionBlockers.filter((b: any) => !b.resolved).map((b: any) => b.task_id);
    const myBlockedTasks = myTasks.filter(t => myBlockedIds.includes(t.id));
    
    if (myBlockedTasks.length > 0) {
      insights.push({
        id: 'dev-blocked',
        severity: 'critical',
        category: 'dependency_risk',
        title: `${myBlockedTasks.length} assigned tasks are blocked`,
        cause: myBlockedTasks.map(t => `${t.name} requires external unblocking`),
        recommendation: 'Escalate to PM and pivot to backlog tasks.',
        expectedImpactText: 'Maintain personal throughput',
        confidence: 100,
        actionRoute: '/execution/board',
        actionLabel: 'View Blockers'
      });
    }

    const urgentTasks = myTasks.filter(t => t.priority === 'high' || t.priority === 'urgent');
    if (urgentTasks.length > 0) {
      insights.push({
        id: 'dev-urgent',
        severity: 'warning',
        category: 'delivery_risk',
        title: `Focus Required: ${urgentTasks.length} High Priority Tasks`,
        cause: [ 'Tasks marked as critical path dependencies' ],
        recommendation: `Complete ${urgentTasks[0].name} first.`,
        expectedImpactText: 'Unblock downstream dependencies',
        confidence: 90,
        actionRoute: '/execution/board',
        actionLabel: 'Start Work'
      });
    }
  }

  // Sort by severity (critical first) and then by confidence (highest first)
  return insights.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    if (a.severity === 'warning' && b.severity === 'info') return -1;
    if (a.severity === 'info' && b.severity === 'warning') return 1;
    return b.confidence - a.confidence;
  });
}

