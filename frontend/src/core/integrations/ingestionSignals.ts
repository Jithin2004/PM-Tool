export type IngestionSignalType =
  | 'commit'
  | 'pull_request'
  | 'merge'
  | 'deploy'
  | 'release_tag'
  | 'incident'
  | 'calendar_event'
  | 'design_review'
  | 'document_change'
  | 'ci_status'
  | 'review_request';

export interface IngestionSignal {
  id: string;
  channel: string;
  type: IngestionSignalType;
  title: string;
  source: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  processed: boolean;
}

const SIGNAL_DESCRIPTIONS: Record<IngestionSignalType, string> = {
  commit: 'Code commit',
  pull_request: 'Pull request opened',
  merge: 'Branch merged',
  deploy: 'Deployment completed',
  release_tag: 'Release tagged',
  incident: 'Incident reported',
  calendar_event: 'Calendar coordination signal',
  design_review: 'Design review requested',
  document_change: 'Document updated',
  ci_status: 'CI pipeline status',
  review_request: 'Review requested',
};

export function describeIngestionSignal(type: IngestionSignalType): string {
  return SIGNAL_DESCRIPTIONS[type] || type;
}

export function createIngestionSignal(
  channel: string,
  type: IngestionSignalType,
  title: string,
  source: string,
  metadata: Record<string, unknown> = {},
): IngestionSignal {
  return {
    id: `${channel}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    channel,
    type,
    title,
    source,
    timestamp: new Date().toISOString(),
    metadata,
    processed: false,
  };
}
