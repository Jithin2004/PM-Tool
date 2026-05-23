import type { OperationalContext, OperationalSection, OperationalState } from './types';

function deriveSectionFromPath(pathname: string): OperationalSection {
  if (pathname.includes('/backlog')) return 'backlog';
  if (pathname.includes('/board')) return 'board';
  if (pathname.includes('/sprints')) return 'sprints';
  if (pathname.includes('/timeline')) return 'timeline';
  if (pathname.includes('/workspace')) return 'workspace';
  if (pathname.includes('/control')) return 'control';
  if (pathname.includes('/resources')) return 'resources';
  if (pathname.includes('/setup')) return 'setup';
  return 'unknown';
}

function deriveProjectIdFromPath(pathname: string): string | undefined {
  const segments = pathname.split('/');
  if (segments[1] === 'projects' && segments[2]) return segments[2];
  return undefined;
}

export function buildOperationalContext(): OperationalContext {
  const pathname = window.location.pathname;
  return {
    projectId: deriveProjectIdFromPath(pathname),
    section: deriveSectionFromPath(pathname),
  };
}

export function deriveOperationalState(section: OperationalSection): OperationalState {
  switch (section) {
    case 'backlog': return 'planning';
    case 'board': return 'in_board';
    case 'sprints': return 'in_sprint';
    case 'timeline': return 'in_timeline';
    case 'workspace': return 'active';
    case 'control': return 'active';
    case 'resources': return 'active';
    default: return 'active';
  }
}

export function describeOperationalState(state: OperationalState): string {
  switch (state) {
    case 'active': return 'active';
    case 'idle': return 'idle';
    case 'away': return 'away';
    case 'reviewing': return 'reviewing';
    case 'editing': return 'editing';
    case 'planning': return 'planning';
    case 'in_sprint': return 'in sprint';
    case 'in_backlog': return 'in backlog';
    case 'in_timeline': return 'in timeline';
    case 'in_board': return 'in board';
    case 'in_analytics': return 'analyzing';
  }
}
