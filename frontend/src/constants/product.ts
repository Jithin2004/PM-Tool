export const PRODUCT_NAME = 'Resolve PM';

export const PRODUCT_PROMISE = 'Deadlines based on how humans actually work';

export const TERMINOLOGY = {
  project: 'Project',
  projects: 'Projects',
  addAsset: 'Create Project',
  executionPipeline: 'Board',
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

export const TASK_STATUSES = ['assigned', 'understanding', 'in_progress', 'blocked', 'ready_for_review', 'changes_requested', 'completed'] as const;

export const EXECUTION_MODES = ['KANBAN', 'SCRUM', 'HYBRID', 'SDLC', 'CUSTOM'] as const;

export const KANBAN_COLUMNS = [
  { id: 'assigned', title: 'Assigned', color: 'border-surface-3/50' },
  { id: 'understanding', title: 'Understanding', color: 'border-teal-500/20' },
  { id: 'in_progress', title: 'In Progress', color: 'border-indigo-500/20' },
  { id: 'blocked', title: 'Blocked', color: 'border-rose-500/20' },
  { id: 'ready_for_review', title: 'Ready for Review', color: 'border-amber-500/20' },
  { id: 'changes_requested', title: 'Changes Requested', color: 'border-orange-500/20' },
  { id: 'completed', title: 'Completed', color: 'border-emerald-500/20' }
];

export const SCRUM_COLUMNS = [
  { id: 'assigned', title: 'Sprint Backlog', color: 'border-surface-3/50' },
  { id: 'understanding', title: 'Understanding', color: 'border-teal-500/20' },
  { id: 'in_progress', title: 'In Progress', color: 'border-indigo-500/20' },
  { id: 'blocked', title: 'Blocked', color: 'border-rose-500/20' },
  { id: 'ready_for_review', title: 'Review', color: 'border-amber-500/20' },
  { id: 'changes_requested', title: 'Changes Requested', color: 'border-orange-500/20' },
  { id: 'completed', title: 'Completed', color: 'border-emerald-500/20' }
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
  'design', 'qa', 'release', 'post-mortem', 'custom',
  'client_review', 'architecture_review', 'deployment'
];

export const MILESTONE_TITLES = [
  'Requirements Approved',
  'QA Signoff',
  'Release Complete'
];

export interface WorkflowTemplate {
  id: string;
  name: string;
  businessTypes: string[];
  executionMode: typeof EXECUTION_MODES[number];
  description: string;
  teamStructure: string;
  lanes: number;
  ceremonies: string[];
  badges: string[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'agile-scrum',
    name: 'Agile Scrum',
    businessTypes: ['Software', 'Startup'],
    executionMode: 'SCRUM',
    description: 'Sprint-based delivery with standups, planning, and retrospectives',
    teamStructure: 'PM + 3-5 Devs + QA',
    lanes: 4,
    ceremonies: ['Daily Standup', 'Sprint Planning', 'Sprint Review', 'Retrospective'],
    badges: ['Sprints', 'Velocity', 'Burndown']
  },
  {
    id: 'lean-startup',
    name: 'Lean Startup',
    businessTypes: ['Software', 'Startup', 'Consulting'],
    executionMode: 'KANBAN',
    description: 'Continuous flow with WIP limits and fast feedback loops',
    teamStructure: 'PM + 2-4 Devs',
    lanes: 5,
    ceremonies: ['Weekly Sync'],
    badges: ['WIP Limits', 'Cycle Time', 'Flow Metrics']
  },
  {
    id: 'enterprise-delivery',
    name: 'Enterprise Delivery',
    businessTypes: ['Software', 'Consulting'],
    executionMode: 'SDLC',
    description: 'Phase-gated delivery with requirements, design, QA, and release stages',
    teamStructure: 'PM + TL + 4-8 Devs + QA + DevOps',
    lanes: 8,
    ceremonies: ['Design Review', 'QA Gate', 'Release Board'],
    badges: ['Phase Gates', 'Compliance', 'Audit Trail']
  },
  {
    id: 'campaign-pipeline',
    name: 'Campaign Pipeline',
    businessTypes: ['Marketing'],
    executionMode: 'KANBAN',
    description: 'Campaign ideation, creation, review, and deployment pipeline',
    teamStructure: 'Marketing Lead + 2-3 Creatives',
    lanes: 5,
    ceremonies: ['Weekly Sync'],
    badges: ['Campaigns', 'Content Calendar', 'Approvals']
  },
  {
    id: 'content-workflow',
    name: 'Content Workflow',
    businessTypes: ['Marketing'],
    executionMode: 'KANBAN',
    description: 'Write-review-publish workflow for content teams',
    teamStructure: 'Editor + 2-5 Writers',
    lanes: 4,
    ceremonies: ['Editorial Meeting'],
    badges: ['SEO Tracking', 'Editorial Calendar', 'Versioning']
  },
  {
    id: 'agency-delivery',
    name: 'Agency Delivery',
    businessTypes: ['Marketing', 'Consulting'],
    executionMode: 'SCRUM',
    description: 'Client delivery with sprints, feedback cycles, and approvals',
    teamStructure: 'Account Manager + 3-6 Creatives',
    lanes: 4,
    ceremonies: ['Client Sync', 'Sprint Planning', 'Review'],
    badges: ['Client Approvals', 'Timesheets', 'Deliverables']
  },
  {
    id: 'site-execution',
    name: 'Site Execution',
    businessTypes: ['Construction'],
    executionMode: 'SDLC',
    description: 'Site preparation through commissioning with phase sign-offs',
    teamStructure: 'Project Manager + Site Engineer + Crew',
    lanes: 6,
    ceremonies: ['Safety Briefing', 'Phase Handover'],
    badges: ['Site Inspections', 'Permits', 'Safety Compliance']
  },
  {
    id: 'procurement-flow',
    name: 'Procurement Flow',
    businessTypes: ['Construction'],
    executionMode: 'KANBAN',
    description: 'Vendor sourcing, PO approval, delivery tracking pipeline',
    teamStructure: 'Procurement Officer + 1-2 Coordinators',
    lanes: 5,
    ceremonies: ['Vendor Review'],
    badges: ['PO Tracking', 'Vendor Scorecard', 'Budget']
  },
  {
    id: 'project-lifecycle',
    name: 'Project Lifecycle',
    businessTypes: ['Construction'],
    executionMode: 'SDLC',
    description: 'Full construction lifecycle from planning to handover',
    teamStructure: 'PM + Architect + Engineer + Contractors',
    lanes: 7,
    ceremonies: ['Progress Review', 'Inspection Gate'],
    badges: ['Milestones', 'Budget Tracking', 'Change Orders']
  },
  {
    id: 'blank',
    name: 'Start Blank',
    businessTypes: ['Software', 'Marketing', 'Construction', 'Consulting', 'Startup', 'Other'],
    executionMode: 'KANBAN',
    description: 'Empty workspace with a basic task board. Configure as you grow.',
    teamStructure: 'Flexible',
    lanes: 5,
    ceremonies: [],
    badges: ['Customizable']
  }
];

export function getTemplatesForBusiness(businessType: string): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES.filter(t => t.businessTypes.includes(businessType));
}
