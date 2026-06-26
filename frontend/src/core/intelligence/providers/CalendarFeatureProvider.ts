import type { IFeatureProvider } from '../contracts/IFeatureProvider';
import type { FeatureVector, FeatureValue } from '../rodm/FeatureVector';

export class CalendarFeatureProvider implements IFeatureProvider {
  public async provideFeatures(entityId: string): Promise<FeatureVector> {
    return {
      vector_id: `vec_cal_${Date.now()}`,
      workspace_id: 'ws_placeholder',
      entity_type: 'calendar_entity',
      entity_id: entityId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      features: {
        'working_hours': this.createStubFeature('working_hours', 160),
        'available_capacity': this.createStubFeature('available_capacity', 120),
        'holiday_density': this.createStubFeature('holiday_density', 0.05),
        'leave_density': this.createStubFeature('leave_density', 0.1),
        'attendance_ratio': this.createStubFeature('attendance_ratio', 0.85)
      }
    };
  }

  private createStubFeature(id: string, value: number): FeatureValue {
    return {
      value,
      metadata: {
        feature_id: id,
        provider: 'CalendarFeatureProvider',
        source: 'calendar_engine',
        normalization_method: null,
        aggregation_method: null,
        generated_at: new Date().toISOString(),
        version: '1.0',
        confidence: 1.0,
        lineage: {
          entity_type: 'calendar_entity',
          entity_id: 'stub_id'
        }
      }
    };
  }
}
