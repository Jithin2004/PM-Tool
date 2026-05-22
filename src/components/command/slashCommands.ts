export interface SlashCommand {
  command: string;
  group: string;
  description: string;
  example: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/create task', group: 'TASKS', description: 'Create a new task', example: '/create task Implement login page' },
  { command: '/create project', group: 'PROJECTS', description: 'Create a new project', example: '/create project Q3 Release' },
  { command: '/create sprint', group: 'ACTIONS', description: 'Start a new sprint', example: '/create sprint Sprint 5' },
  { command: '/assign', group: 'TASKS', description: 'Assign a task to a user', example: '/assign @jane TASK-123' },
  { command: '/summarize sprint', group: 'AI', description: 'Generate sprint summary', example: '/summarize sprint Sprint 4' },
  { command: '/find blockers', group: 'AI', description: 'Find blocked tasks', example: '/find blockers' },
  { command: '/find overdue', group: 'AI', description: 'Find overdue tasks', example: '/find overdue' },
  { command: '/open', group: 'NAVIGATION', description: 'Navigate to a page', example: '/open timeline' },
  { command: '/search', group: 'NAVIGATION', description: 'Search across workspace', example: '/search landing page' },
  { command: '/analytics', group: 'NAVIGATION', description: 'Open analytics dashboard', example: '/analytics' },
  { command: '/workload', group: 'AI', description: 'View team workload', example: '/workload' },
  { command: '/risks', group: 'AI', description: 'View project risks', example: '/risks' },
  { command: '/status', group: 'TASKS', description: 'Update task status', example: '/status TASK-456 done' },
  { command: '/comment', group: 'TASKS', description: 'Add comment to task', example: '/comment TASK-456 Looks good' },
  { command: '/invite', group: 'ACTIONS', description: 'Invite a team member', example: '/invite user@email.com' },
];

export function getSlashCommandsForGroup(group: string): SlashCommand[] {
  return SLASH_COMMANDS.filter((s) => s.group === group);
}

export function findSlashCommand(input: string): SlashCommand | undefined {
  const cmd = input.split(' ')[0].toLowerCase();
  return SLASH_COMMANDS.find((s) => s.command === cmd || s.command.startsWith(cmd));
}
