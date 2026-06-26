import type { IPersistenceAdapter } from './IPersistenceAdapter';
import { IntelligenceEvents } from './PersistenceEvents';

export class IntelligencePersistenceGateway {
  constructor(private adapter: IPersistenceAdapter) {}

  private validateLineage(payload: any): void {
    if (!payload.workspace_id) throw new Error("Validation Failed: Missing workspace_id.");
    if (!payload.snapshot_reference && !payload.mathematical_snapshot_id) {
      throw new Error("Validation Failed: Missing snapshot lineage reference.");
    }
    if (!payload.version && !payload.algorithm_version && !payload.engine_version) {
      throw new Error("Validation Failed: Missing versioning constraints.");
    }
  }

  public async savePrediction(prediction: any): Promise<void> {
    this.validateLineage(prediction);
    await this.adapter.insertPredictionHistory(prediction);
    await this.adapter.logEvent({
      event_id: `ev_${Date.now()}`,
      event_type: IntelligenceEvents.PredictionGenerated,
      timestamp: new Date().toISOString(),
      workspace_id: prediction.workspace_id,
      payload: { prediction_id: prediction.prediction_id }
    });
  }

  public async saveFeatureSnapshot(snapshot: any): Promise<void> {
    this.validateLineage(snapshot);
    await this.adapter.insertFeatureSnapshot(snapshot);
  }

  public async saveMathematicalSnapshot(snapshot: any): Promise<void> {
    this.validateLineage(snapshot);
    await this.adapter.insertPredictionSnapshot(snapshot);
  }

  public async saveEvaluation(evaluation: any): Promise<void> {
    this.validateLineage(evaluation);
    await this.adapter.insertPredictionAccuracy(evaluation);
    await this.adapter.logEvent({
      event_id: `ev_${Date.now()}`,
      event_type: IntelligenceEvents.PredictionEvaluated,
      timestamp: new Date().toISOString(),
      workspace_id: evaluation.workspace_id,
      payload: { accuracy_id: evaluation.accuracy_id }
    });
  }

  public async saveSimulation(simulation: any): Promise<void> {
    this.validateLineage(simulation);
    await this.adapter.insertSimulationRun(simulation);
    await this.adapter.logEvent({
      event_id: `ev_${Date.now()}`,
      event_type: IntelligenceEvents.SimulationCompleted,
      timestamp: new Date().toISOString(),
      workspace_id: simulation.workspace_id,
      payload: { simulation_id: simulation.simulation_id }
    });
  }

  public async saveDatasetExport(dataset: any): Promise<void> {
    this.validateLineage(dataset);
    await this.adapter.insertDatasetVersion(dataset);
    await this.adapter.logEvent({
      event_id: `ev_${Date.now()}`,
      event_type: IntelligenceEvents.DatasetExported,
      timestamp: new Date().toISOString(),
      workspace_id: dataset.workspace_id,
      payload: { dataset_version: dataset.dataset_version }
    });
  }
}
