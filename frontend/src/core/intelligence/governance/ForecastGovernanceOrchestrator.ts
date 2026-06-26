import type { ForecastResult } from '../forecast/ForecastResult';
import type { GovernedForecast } from './GovernedForecast';
import { PolicyRegistry } from './PolicyRegistry';
import { ForecastPolicyEngine } from './ForecastPolicyEngine';
import { ForecastRuleEngine } from './ForecastRuleEngine';
import { ForecastAssumptionRegistry } from './ForecastAssumptionRegistry';
import { ForecastStabilityEngine } from './ForecastStabilityEngine';
import { ForecastDriftEngine } from './ForecastDriftEngine';
import { ForecastHistoryEngine } from './ForecastHistoryEngine';
import { ForecastValidationEngine } from './ForecastValidationEngine';
import { ForecastConstitutionValidator } from './ForecastConstitutionValidator';

export class ForecastGovernanceOrchestrator {
  private policyRegistry = new PolicyRegistry();
  private assumptionRegistry = new ForecastAssumptionRegistry();
  
  private policyEngine = new ForecastPolicyEngine(this.policyRegistry);
  private ruleEngine = new ForecastRuleEngine(this.policyRegistry);
  private stabilityEngine = new ForecastStabilityEngine();
  private driftEngine = new ForecastDriftEngine();
  private historyEngine = new ForecastHistoryEngine();
  private validationEngine = new ForecastValidationEngine();

  public governForecast(forecast: ForecastResult, previousForecast: ForecastResult | null): GovernedForecast {
    
    const policyResults = this.policyEngine.evaluatePolicies(forecast);
    const ruleResults = this.ruleEngine.evaluateRules(forecast);
    const assumptions = this.assumptionRegistry.getAssumptionsForForecast(forecast.forecast_id);
    const stability = this.stabilityEngine.calculateStability(forecast, previousForecast ? [previousForecast] : []);
    const drift = this.driftEngine.calculateDrift(forecast, previousForecast);
    const metrics = this.validationEngine.validateAgainstReality(forecast, null);

    const historyRef = this.historyEngine.appendHistory(forecast, { policies: policyResults, assumptions });

    const governedForecast: GovernedForecast = {
      governance_id: `gov_${Date.now()}`,
      forecast,
      policy_results: policyResults,
      rule_results: ruleResults,
      assumptions,
      evidence: forecast.evidence,
      recommendations: forecast.recommendations,
      forecast_stability: stability,
      forecast_drift: drift,
      validation_metrics: metrics,
      governance_version: {
        orchestrator_version: '1.0.0',
        policy_engine_version: '1.0.0',
        rule_engine_version: '1.0.0'
      },
      history_reference: historyRef,
      views: {
        pm_view: {},
        executive_view: {},
        finance_view: {},
        client_view: {},
        operations_view: {}
      },
      future_hooks: {
        monte_carlo_ready: true,
        bayesian_ready: true,
        learning_ready: true,
        calibration_ready: true,
        scenario_ready: true,
        optimization_ready: true,
        risk_simulator_ready: true,
        decision_optimizer_ready: true
      }
    };

    // Strictly validate before allowing the forecast to proceed
    ForecastConstitutionValidator.validate(governedForecast);

    return governedForecast;
  }
}
