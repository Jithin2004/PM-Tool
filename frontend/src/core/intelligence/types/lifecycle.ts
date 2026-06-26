export type PredictionLifecycle = 
  | 'generated'
  | 'accepted'
  | 'updated'
  | 'validated'
  | 'archived'
  | 'learning_pending'
  | 'learning_complete';
