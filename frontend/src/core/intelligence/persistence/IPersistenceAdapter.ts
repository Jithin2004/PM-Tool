import type { PersistenceEvent } from './PersistenceEvents';

export interface IPersistenceAdapter {
  insertPredictionSnapshot(snapshot: any): Promise<void>;
  insertPredictionHistory(history: any): Promise<void>;
  insertPredictionAccuracy(accuracy: any): Promise<void>;
  insertFeatureSnapshot(snapshot: any): Promise<void>;
  insertSimulationRun(run: any): Promise<void>;
  insertDatasetVersion(version: any): Promise<void>;
  insertTelemetry(telemetry: any): Promise<void>;
  insertForecastFeedback(feedback: any): Promise<void>;
  logEvent(event: PersistenceEvent): Promise<void>;
}
