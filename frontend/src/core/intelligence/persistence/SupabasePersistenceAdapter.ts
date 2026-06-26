import type { IPersistenceAdapter } from './IPersistenceAdapter';
import type { PersistenceEvent } from './PersistenceEvents';
import { supabase } from '../../../lib/supabase'; // Adjusted relative path assuming standard structure

export class SupabasePersistenceAdapter implements IPersistenceAdapter {
  
  async insertPredictionSnapshot(snapshot: any): Promise<void> {
    const { error } = await supabase.from('prediction_snapshots').insert(snapshot);
    if (error) throw new Error(`Failed to insert prediction_snapshots: ${error.message}`);
  }
  
  async insertPredictionHistory(history: any): Promise<void> {
    const { error } = await supabase.from('prediction_history').insert(history);
    if (error) throw new Error(`Failed to insert prediction_history: ${error.message}`);
  }
  
  async insertPredictionAccuracy(accuracy: any): Promise<void> {
    const { error } = await supabase.from('prediction_accuracy').insert(accuracy);
    if (error) throw new Error(`Failed to insert prediction_accuracy: ${error.message}`);
  }
  
  async insertFeatureSnapshot(snapshot: any): Promise<void> {
    const { error } = await supabase.from('feature_snapshots').insert(snapshot);
    if (error) throw new Error(`Failed to insert feature_snapshots: ${error.message}`);
  }
  
  async insertSimulationRun(run: any): Promise<void> {
    const { error } = await supabase.from('simulation_runs').insert(run);
    if (error) throw new Error(`Failed to insert simulation_runs: ${error.message}`);
  }
  
  async insertDatasetVersion(version: any): Promise<void> {
    const { error } = await supabase.from('learning_dataset_versions').insert(version);
    if (error) throw new Error(`Failed to insert learning_dataset_versions: ${error.message}`);
  }
  
  async insertTelemetry(telemetry: any): Promise<void> {
    const { error } = await supabase.from('forecast_telemetry').insert(telemetry);
    if (error && error.code !== '42P01') { 
      console.warn('Telemetry insert failed', error);
    }
  }
  
  async insertForecastFeedback(feedback: any): Promise<void> {
    const { error } = await supabase.from('forecast_feedback').insert(feedback);
    if (error) throw new Error(`Failed to insert forecast_feedback: ${error.message}`);
  }

  async logEvent(event: PersistenceEvent): Promise<void> {
    const { error } = await supabase.from('intelligence_audit_log').insert(event);
    if (error && error.code !== '42P01') {
      console.warn('Event log failed', error);
    }
  }
}
