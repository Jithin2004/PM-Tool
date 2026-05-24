export type EmptyContext = 'no-projects' | 'no-board-items' | 'no-backlog' | 'no-sprints' | 'no-team' | 'no-integrations' | 'no-activity' | 'no-insights';

export interface EmptyStateConfig {
  context: EmptyContext;
  title: string;
  description: string;
  action: string;
  showAction: boolean;
}

export const EMPTY_STATE_MAP: Record<EmptyContext, EmptyStateConfig> = {
  'no-projects': {
    context: 'no-projects',
    title: 'No Projects Yet',
    description: 'Create your first project to begin execution tracking.',
    action: 'Create Project',
    showAction: true,
  },
  'no-board-items': {
    context: 'no-board-items',
    title: 'Board is Empty',
    description: 'Add items to the backlog to populate the board.',
    action: 'Go to Backlog',
    showAction: true,
  },
  'no-backlog': {
    context: 'no-backlog',
    title: 'Backlog is Clear',
    description: 'All items have been processed. Add new tasks to continue.',
    action: 'Add Task',
    showAction: true,
  },
  'no-sprints': {
    context: 'no-sprints',
    title: 'No Active Sprints',
    description: 'Start a sprint to begin tracking execution cycles.',
    action: 'Start Sprint',
    showAction: true,
  },
  'no-team': {
    context: 'no-team',
    title: 'No Team Members',
    description: 'Invite team members to enable coordination intelligence.',
    action: 'Invite Team',
    showAction: true,
  },
  'no-integrations': {
    context: 'no-integrations',
    title: 'No Channels Connected',
    description: 'Connect operational channels to stream execution signals.',
    action: 'Connect Channel',
    showAction: true,
  },
  'no-activity': {
    context: 'no-activity',
    title: 'No Recent Activity',
    description: 'Activity will appear here as the team executes.',
    action: '',
    showAction: false,
  },
  'no-insights': {
    context: 'no-insights',
    title: 'Insufficient Data',
    description: 'Coordination insights require more execution history.',
    action: '',
    showAction: false,
  },
};

export function getEmptyState(context: EmptyContext): EmptyStateConfig {
  return EMPTY_STATE_MAP[context];
}
