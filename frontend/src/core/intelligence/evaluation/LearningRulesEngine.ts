import type { EvidenceGraph } from '../evidence/EvidenceGraph';

export class LearningRulesEngine {
  public evaluateRules(metrics: any, evidence: EvidenceGraph): any[] {
    const recommendations = [];

    // Deterministic Learning Rules (No ML)
    if (metrics.bias < -0.15) {
      recommendations.push({
        rule: 'systematic_optimism_detected',
        recommendation: 'Increase estimation multiplier by 15%.',
        evidence_references: ['forecast_history', 'calibration_bias_metric']
      });
    }

    if (metrics.approval_latency_increase > 0.20) {
      recommendations.push({
        rule: 'client_approval_latency_increased',
        recommendation: 'Apply timeline adjustment of +2 days to future milestones.',
        evidence_references: ['actual_outcome_tracker', 'evidence_graph_wait_state']
      });
    }

    if (metrics.capacity_failures > 3) {
      recommendations.push({
        rule: 'capacity_assumptions_failing',
        recommendation: 'Reduce capacity forecast confidence by 20%.',
        evidence_references: ['calibration_capacity_metric']
      });
    }

    return recommendations;
  }
}
