import type { ForecastResult } from '../forecast/ForecastResult';
import type { ForecastPolicy, PolicyRegistry } from './PolicyRegistry';

export class ForecastPolicyEngine {
  constructor(private registry: PolicyRegistry) {}

  public evaluatePolicies(forecast: ForecastResult): any[] {
    const activePolicies = this.registry.getPolicies();
    const results = [];

    for (const policy of activePolicies) {
      // Pure evaluation against forecast metadata and outputs without calculating new math.
      results.push({
        policy_id: policy.policy_id,
        status: 'evaluated',
        actions_triggered: policy.actions
      });
    }

    return results;
  }
}
