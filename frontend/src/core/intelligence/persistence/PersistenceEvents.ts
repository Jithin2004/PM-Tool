export interface PersistenceEvent {
  event_id: string;
  event_type: string;
  timestamp: string;
  workspace_id: string;
  payload: any;
}

export const IntelligenceEvents = {
  PredictionGenerated: 'PredictionGenerated',
  PredictionEvaluated: 'PredictionEvaluated',
  PredictionValidated: 'PredictionValidated',
  PredictionCalibrated: 'PredictionCalibrated',
  DatasetExported: 'DatasetExported',
  SimulationCompleted: 'SimulationCompleted',
  ReplayExecuted: 'ReplayExecuted',
  FeedbackCaptured: 'FeedbackCaptured'
} as const;
