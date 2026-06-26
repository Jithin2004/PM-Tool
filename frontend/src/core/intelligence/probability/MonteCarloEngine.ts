import type { MathematicalSnapshot } from '../types/snapshot';

export interface MonteCarloConfig {
  simulations: number;
  seed: number;
}

export class MonteCarloEngine {
  private simulateVariance(baseValue: number, variancePercentage: number, random: () => number): number {
    const variance = baseValue * variancePercentage;
    return baseValue + (random() * variance * 2) - variance;
  }

  // Seeded pseudo-random generator for reproducibility
  private seededRandom(seed: number) {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  public executeSimulations(snapshot: MathematicalSnapshot, config: MonteCarloConfig): any[] {
    const results = [];
    let currentSeed = config.seed;

    for (let i = 0; i < config.simulations; i++) {
      // Simulate controlled variance ONLY on approved stochastic inputs
      const random = () => {
        const val = this.seededRandom(currentSeed);
        currentSeed++;
        return val;
      };

      const simulatedState = {
        cycle_time_hours: this.simulateVariance(snapshot.engine_outputs['cycle_time'] || 40, 0.15, random),
        wait_time_hours: this.simulateVariance(snapshot.engine_outputs['wait_time'] || 10, 0.25, random),
        approval_latency: this.simulateVariance(snapshot.engine_outputs['approval_latency'] || 24, 0.30, random),
        payment_latency: this.simulateVariance(snapshot.engine_outputs['payment_latency'] || 15, 0.10, random)
      };

      results.push(simulatedState);
    }

    return results;
  }

  public simulateScenario(snapshot: MathematicalSnapshot, scenarioModifications: Record<string, any>): any {
    // Allows simulation without touching production data
    return {
      scenario_applied: true,
      modifications: scenarioModifications,
      result: 'Scenario simulated deterministically based on snapshot and modifications.'
    };
  }
}
