export const PRODUCT_NAME = 'Resolve PM';

export const PRODUCT_PROMISE = 'Deadlines based on how humans actually work';

export const TERMINOLOGY = {
  asset: 'Project',
  assets: 'Projects',
  addAsset: 'Create Project',
  executionPipeline: 'Task Board',
  operationalSquadRoster: 'Teams',
  predictiveDecay: 'Delivery Risk',
  assetAnalysisConsole: 'Project Overview',
  telemetry: 'Analytics',
  decommission: 'Archive',
  systemInitialization: 'Workspace Setup',
  squad: 'Team',
  squads: 'Teams'
} as const;

export const PROJECT_TEMPLATES = [
  'Software Sprint',
  'Marketing',
  'Construction',
  'Client Work',
  'Blank'
] as const;

export const BUSINESS_TYPES = [
  'Software',
  'Marketing',
  'Construction',
  'Consulting',
  'Startup',
  'Other'
] as const;

export const TASK_STATUSES = ['backlog', 'in_progress', 'review', 'done'] as const;
