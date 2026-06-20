import { computeImpact, propagateAndPersist, type ImpactInput, type ImpactResult } from '../../services/timelineImpactEngine';
import type { Task } from '../../types';

export const timelineSimulationEngine = {
  /**
   * Dry-run simulation of a timeline change to calculate downstream impacts
   * without persisting.
   */
  async simulateDateChange(input: ImpactInput): Promise<ImpactResult> {
    // computeImpact inside timelineImpactEngine already acts as a simulation
    // since it does not mutate the DB (propagateAndPersist handles mutation).
    const result = await computeImpact(input);
    return result;
  },

  /**
   * Parses the impact result and returns a summary for the Confirmation Modal
   */
  calculateImpactSummary(result: ImpactResult) {
    const tasksAffected = result.affectedEntities.length;
    const totalDelayDays = result.etaDelta;
    
    // Milestones are affected if their underlying tasks are pushed past the milestone deadline.
    // For pure simulation summary, we count the raw tasks and risk changes.
    const riskIncreases = result.riskDelta;
    
    return {
      tasksAffected,
      milestonesAffected: 0, // Advanced: intersect affected entities with milestone boundaries
      totalDelayDays,
      riskIncreases,
      confidenceDelta: result.confidenceDelta
    };
  },

  /**
   * Applies the timeline change persistently (after user confirmation)
   */
  async applyTimelineChange(
    input: ImpactInput, 
    simulationResult: ImpactResult,
    onProgress?: (processed: number, total: number) => void
  ): Promise<void> {
    await propagateAndPersist(input, simulationResult, onProgress);
  }
};
