export interface ForecastPolicy {
  policy_id: string;
  name: string;
  description: string;
  scope: string[];
  conditions: any[];
  actions: any[];
  priority: number;
  enabled: boolean;
  version: string;
  effective_date: string;
}

export interface BusinessRule {
  rule_id: string;
  conditions: any[];
  operators: string[];
  actions: any[];
  severity: string;
  priority: number;
  evaluation_order: number;
}

export class PolicyRegistry {
  private policies = new Map<string, ForecastPolicy>();
  private rules = new Map<string, BusinessRule>();

  public registerPolicy(policy: ForecastPolicy): void {
    this.policies.set(policy.policy_id, policy);
  }

  public registerRule(rule: BusinessRule): void {
    this.rules.set(rule.rule_id, rule);
  }

  public getPolicies(): ForecastPolicy[] {
    return Array.from(this.policies.values()).filter(p => p.enabled);
  }

  public getRules(): BusinessRule[] {
    return Array.from(this.rules.values()).sort((a, b) => a.evaluation_order - b.evaluation_order);
  }
}
