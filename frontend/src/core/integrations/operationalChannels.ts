export type ChannelState =
  | 'unavailable'
  | 'configuring'
  | 'awaiting_oauth'
  | 'connecting'
  | 'connected'
  | 'degraded'
  | 'reconnecting'
  | 'ingestion_paused'
  | 'webhook_error';

export type ChannelScope = 'workspace' | 'project';

export interface OperationalChannel {
  id: string;
  key: string;
  label: string;
  description: string;
  scope: ChannelScope;
  state: ChannelState;
  lastIngestion: string | null;
  lastChecked: string | null;
}

export const OPERATIONAL_CHANNELS: OperationalChannel[] = [
  {
    id: 'repository_activity',
    key: 'github',
    label: 'Repository Activity',
    description: 'Pull requests, commits, branch activity, code review signals',
    scope: 'project',
    state: 'awaiting_oauth',
    lastIngestion: null,
    lastChecked: null,
  },
  {
    id: 'repository_activity_alt',
    key: 'gitlab',
    label: 'Repository Activity',
    description: 'Merge requests, CI/CD status, repository events',
    scope: 'project',
    state: 'awaiting_oauth',
    lastIngestion: null,
    lastChecked: null,
  },
  {
    id: 'design_coordination',
    key: 'figma',
    label: 'Design Coordination',
    description: 'Design system updates, review requests, asset changes',
    scope: 'project',
    state: 'awaiting_oauth',
    lastIngestion: null,
    lastChecked: null,
  },
  {
    id: 'document_coordination',
    key: 'google_drive',
    label: 'Document Coordination',
    description: 'Specifications, runbooks, operational documents',
    scope: 'project',
    state: 'awaiting_oauth',
    lastIngestion: null,
    lastChecked: null,
  },
];
