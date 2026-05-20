export const PRODUCT_NAME = 'Resolve PM';

export const PRODUCT_PROMISE = 'Deadlines based on how humans actually work';

export const TERMINOLOGY = {
  project: 'Project',
  projects: 'Projects',
  addAsset: 'Create Project',
  executionPipeline: 'Task Board',
  operationalSquadRoster: 'Teams',
  predictiveDecay: 'Delivery Risk',
  assetAnalysisConsole: 'Project Overview',
  analytics: 'Analytics',
  archive: 'Archive',
  systemInitialization: 'Workspace Setup',
  team: 'Team',
  teams: 'Teams'
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

export const TASK_STATUSES = ['backlog', 'ready', 'in_progress', 'review', 'done'] as const;

export const EXECUTION_MODES = ['KANBAN', 'SCRUM', 'SDLC', 'CUSTOM'] as const;

export const KANBAN_COLUMNS = [
  { id: 'backlog', title: 'Triage / Backlog', color: 'border-blue-500/20' },
  { id: 'ready', title: 'Ready', color: 'border-cyan-500/20' },
  { id: 'in_progress', title: 'In Flight', color: 'border-yellow-500/20' },
  { id: 'review', title: 'Validation Roster', color: 'border-green-500/20' },
  { id: 'done', title: 'Done', color: 'border-emerald-500/20' }
];

export const SCRUM_COLUMNS = [
  { id: 'backlog', title: 'Sprint Backlog', color: 'border-purple-500/20' },
  { id: 'in_progress', title: 'In Progress', color: 'border-yellow-500/20' },
  { id: 'review', title: 'Code Review', color: 'border-orange-500/20' },
  { id: 'done', title: 'Merged Releases', color: 'border-emerald-500/20' }
];

export const SDLC_PHASES = [
  { id: 'initiation', title: 'Initiation', icon: 'Flag', color: 'border-blue-500/20' },
  { id: 'requirements', title: 'Requirements', icon: 'FileText', color: 'border-indigo-500/20' },
  { id: 'planning', title: 'Planning', icon: 'Calendar', color: 'border-purple-500/20' },
  { id: 'design', title: 'Design', icon: 'PenTool', color: 'border-pink-500/20' },
  { id: 'development', title: 'Development', icon: 'Code', color: 'border-yellow-500/20' },
  { id: 'qa', title: 'QA / Testing', icon: 'TestTube', color: 'border-orange-500/20' },
  { id: 'release', title: 'Release', icon: 'Rocket', color: 'border-green-500/20' },
  { id: 'post_release', title: 'Post-Release', icon: 'Activity', color: 'border-emerald-500/20' }
];

export const MEETING_TYPES = [
  'sync', 'planning', 'review', 'retrospective', 'standup',
  'design', 'qa', 'release', 'post-mortem', 'custom'
];
