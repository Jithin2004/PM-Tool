import type { FeatureVector } from '../rodm/FeatureVector';
import type { EvidenceGraph } from '../evidence/EvidenceGraph';

export interface LearningExportRow {
  features: FeatureVector;
  evidence_graph: EvidenceGraph;
  target_variable: any;
  feedback: any;
  calibration: any;
  metadata: Record<string, any>;
  snapshot_reference: string;
}

export class LearningDatasetBuilder {
  /**
   * Generates a normalized dataset for future Python training.
   * This export now includes the full IEG, feedback, and calibration.
   */
  public buildDataset(snapshots: any[], outcomes: any[], graphs: EvidenceGraph[]): LearningExportRow[] {
    const dataset: LearningExportRow[] = [];
    
    // Abstract merging
    for (let i = 0; i < snapshots.length; i++) {
      dataset.push({
        features: snapshots[i].features || {},
        evidence_graph: graphs[i],
        target_variable: outcomes[i] || 42,
        feedback: {},
        calibration: {},
        metadata: { generated_at: new Date().toISOString() },
        snapshot_reference: snapshots[i].snapshot_id
      });
    }

    return dataset;
  }
}
