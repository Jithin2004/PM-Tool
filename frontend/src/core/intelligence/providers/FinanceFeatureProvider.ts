import type { IFeatureProvider } from '../contracts/IFeatureProvider';
import type { FeatureVector, FeatureValue } from '../rodm/FeatureVector';

export class FinanceFeatureProvider implements IFeatureProvider {
  public async provideFeatures(entityId: string): Promise<FeatureVector> {
    return {
      vector_id: `vec_fin_${Date.now()}`,
      workspace_id: 'ws_placeholder',
      entity_type: 'finance_entity',
      entity_id: entityId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      features: {
        'payment_latency': this.createStubFeature('payment_latency', 15),
        'invoice_delay': this.createStubFeature('invoice_delay', 5),
        'budget_burn_rate': this.createStubFeature('budget_burn_rate', 1500),
        'invoice_frequency': this.createStubFeature('invoice_frequency', 1.2),
        'expense_growth': this.createStubFeature('expense_growth', 0.05),
        'cashflow_variance': this.createStubFeature('cashflow_variance', 5000)
      }
    };
  }

  private createStubFeature(id: string, value: number): FeatureValue {
    return {
      value,
      metadata: {
        feature_id: id,
        provider: 'FinanceFeatureProvider',
        source: 'finance_engine',
        normalization_method: null,
        aggregation_method: null,
        generated_at: new Date().toISOString(),
        version: '1.0',
        confidence: 1.0,
        lineage: {
          entity_type: 'finance_entity',
          entity_id: 'stub_id'
        }
      }
    };
  }
}
