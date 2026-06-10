import { DecisionInsight } from './DecisionIntelligenceEngine';

export interface ExplanationDetails {
  whyNow: string;
  whyThisFix: string;
  whatIfIgnored: string;
}

export function buildExplanation(
  category: string,
  baseInsight: Partial<DecisionInsight>,
  context: any
): ExplanationDetails {
  const { project, tasks, users, targetUser, metrics } = context;

  const expl: ExplanationDetails = {
    whyNow: 'Based on current signals, risk factors have reached a critical threshold today.',
    whyThisFix: 'This represents a statistically favorable resolution path.',
    whatIfIgnored: 'Project delivery timelines face increased risk of compromise.'
  };

  switch (category) {
    case 'team_overload':
      expl.whyNow = `Based on current signals, operator utilization exceeded 120% this week. Continued operation at this level indicates a high probability of burnout and schedule slips.`;
      if (targetUser) {
        expl.whyThisFix = `Reallocating to ${targetUser.full_name || targetUser.email} is recommended as they share the same department and currently show ${metrics.freeHours} free hours in capacity.`;
      } else {
        expl.whyThisFix = 'Task reallocation is advised to balance capacity across the available talent pool.';
      }
      expl.whatIfIgnored = 'Historical data suggests a potential project slip of 3-5 working days due to operator fatigue.';
      break;

    case 'dependency_risk':
      expl.whyNow = `Based on current signals, wait-state latency is actively compounding. ${metrics.blockerCount} execution blockers are currently impeding critical path progress.`;
      expl.whyThisFix = 'Immediate escalation facilitates coordination and reduces the probability of a complete stream stall.';
      expl.whatIfIgnored = 'Downstream tasks are at risk of starving for input, which could halt the delivery pipeline.';
      break;

    case 'delivery_risk':
      expl.whyNow = `Based on current signals, high-risk tasks on the critical path show signs of stalling.`;
      expl.whyThisFix = 'Shifting deadlines or reassigning work can mitigate the immediate schedule pressure.';
      expl.whatIfIgnored = 'Models indicate a potential project slip equivalent to the accumulated delay of blocked tasks.';
      break;

    case 'estimation_failure':
      expl.whyNow = `Based on current signals, total actual hours have exceeded planned hours by ${metrics.excessHours} hours, with multiple tasks exceeding 150% of estimates.`;
      expl.whyThisFix = 'Scope calibration can stop budget bleed and reset stakeholder expectations.';
      expl.whatIfIgnored = 'This trend indicates potential margin erosion and compounding delays on subsequent projects.';
      break;

    case 'revenue_risk':
      expl.whyNow = `Based on current signals, payment milestones have been missed, indicating potential cash flow stalls.`;
      expl.whyThisFix = 'Halting deliverables can force immediate client prioritization of outstanding invoices.';
      expl.whatIfIgnored = 'This trajectory increases the risk of an extended cash conversion cycle and potential write-offs.';
      break;
      
    case 'hr_risk':
      expl.whyNow = `Based on current signals, a key operator contract is expiring within 30 days while they hold active critical-path tasks.`;
      expl.whyThisFix = 'Immediate handover planning can prevent silent knowledge loss and orphaned tasks.';
      expl.whatIfIgnored = 'Orphaned tasks typically require re-onboarding overhead, historically causing a 1-week slip per affected module.';
      break;
  }

  return expl;
}
