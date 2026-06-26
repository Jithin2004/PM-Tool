import type { IFeatureProvider } from '../contracts/IFeatureProvider';
import type { FeatureVector, FeatureValue } from '../rodm/FeatureVector';

export class ExecutionFeatureProvider implements IFeatureProvider {
  public async provideFeatures(entityId: string): Promise<FeatureVector> {
    // This is an architectural stub that defines the source contract.
    // In production, this would query the local repositories (NOT the DB directly, but internal data services)
    // for tasks, milestones, sprints, wait states, dependencies, activity events.
    
    return {
      vector_id: `vec_exec_${Date.now()}`,
      workspace_id: 'ws_placeholder',
      entity_type: 'execution_entity',
      entity_id: entityId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      features: {
        'cycle_time_hours': this.createStubFeature('cycle_time_hours', 120),
        'wait_time_hours': this.createStubFeature('wait_time_hours', 24),
        'work_time_hours': this.createStubFeature('work_time_hours', 96),
        'delay_drift_days': this.createStubFeature('delay_drift_days', 2),
        'dependency_count': this.createStubFeature('dependency_count', 3),
        'critical_path_slack': this.createStubFeature('critical_path_slack', 0),
        'reassignment_count': this.createStubFeature('reassignment_count', 1),
        'blocker_count': this.createStubFeature('blocker_count', 2),
        'scope_change_count': this.createStubFeature('scope_change_count', 0),
        'velocity': this.createStubFeature('velocity', 45)
      }
    };
  }

  private createStubFeature(id: string, value: number): FeatureValue {
    return {
      value,
      metadata: {
        feature_id: id,
        provider: 'ExecutionFeatureProvider',
        source: 'execution_engine',
        normalization_method: null,
        aggregation_method: null,
        generated_at: new Date().toISOString(),
        version: '1.0',
        confidence: 1.0,
        lineage: {
          entity_type: 'execution_entity',
          entity_id: 'stub_id'
        }
      }
    };
  }
}
