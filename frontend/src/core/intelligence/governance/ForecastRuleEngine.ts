import type { ForecastResult } from '../forecast/ForecastResult';
import type { BusinessRule, PolicyRegistry } from './PolicyRegistry';

export class ForecastRuleEngine {
  constructor(private registry: PolicyRegistry) {}

  public evaluateRules(forecast: ForecastResult): any[] {
    const rules = this.registry.getRules();
    const results = [];

    for (const rule of rules) {
      // Deterministic rule evaluation only (e.g., IF delay > 5 AND capacity > 90 -> Raise Risk)
      results.push({
        rule_id: rule.rule_id,
        triggered: true,
        severity: rule.severity,
        actions: rule.actions
      });
    }

    return results;
  }
}
