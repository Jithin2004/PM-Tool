import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useTasks } from '../../hooks/useTasks';
import { useCalendarEvents } from '../../hooks/useCalendarEvents';
import { activityLogService } from '../../services/activityLogService';
import BoardView from '../../components/execution/BoardView';
import TimelineView from '../../components/execution/TimelineView';
import ExecutionGanttView from '../../components/execution/GanttView';
import SprintView from '../../components/execution/SprintView';
import type { Milestone, Meeting, Epic } from '../../types';

const ROUTE_IDENTITY: Record<string, { title: string; subtitle: string; view: 'board' | 'timeline' | 'gantt' | 'sprint' }> = {
  '/execution': { title: 'Execution Board', subtitle: 'Kanban · Scrum · Hybrid workflow execution', view: 'board' },
  '/execution/board': { title: 'Execution Board', subtitle: 'Kanban · Scrum · Hybrid workflow execution', view: 'board' },
  '/execution/timeline': { title: 'Timeline Engine', subtitle: 'Dependency propagation and scheduling intelligence', view: 'timeline' },
  '/execution/gantt': { title: 'Gantt Workspace', subtitle: 'Critical path + delivery planning', view: 'gantt' },
  '/execution/sprints': { title: 'Sprint Center', subtitle: 'Velocity · Burndown · Retrospectives', view: 'sprint' },
};

export function PipelinePanel({ routePath }: { routePath?: string }) {
  const { profile } = useAuth();
  const { workspace } = useWorkspace();
  const { tasks: allTasks } = useTasks(workspace?.id);
  const identity = ROUTE_IDENTITY[routePath || ''] || ROUTE_IDENTITY['/execution'];
  const { projects, profiles, notify, fetchProjects, handlePromoteTaskToAsset, updateExecutionMode } = useDashboard();
  const [milestones] = React.useState<Milestone[]>([]);
  const [meetings] = React.useState<Meeting[]>([]);
  const [epics] = React.useState<Epic[]>([]);
  const { events: calendarEvents } = useCalendarEvents(workspace?.id);

  const kanbanProjects = useMemo(() => projects.filter((p: any) => p.execution_mode === 'KANBAN'), [projects]);
  const scrumProjects = useMemo(() => projects.filter((p: any) => p.execution_mode === 'SCRUM'), [projects]);
  const sdlcProjects = useMemo(() => projects.filter((p: any) => p.execution_mode === 'SDLC'), [projects]);

  const handleConvertToScrum = async (projectId: string) => {
    if (!updateExecutionMode) return;
    await updateExecutionMode(projectId, 'SCRUM');
    await activityLogService.appendLog({
      workspace_id: projects.find((p: any) => p.id === projectId)?.workspace_id || '',
      actor_id: profile?.id, project_id: projectId,
      action: 'converted_to_scrum',
      metadata: { previous_mode: 'KANBAN', new_mode: 'SCRUM' }
    });
    fetchProjects();
  };

  return (
    <main className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12">
      <div className="flex justify-between items-center mb-8 bg-[#090a0f]/40 border border-white/10 p-4 rounded-lg backdrop-blur-md">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">{identity.title}</h2>
          <p className="text-[10px] font-mono text-white/50 uppercase">{identity.subtitle}</p>
        </div>
      </div>

      {identity.view === 'gantt' ? (
        <ExecutionGanttView
          milestones={milestones}
          meetings={meetings}
          projects={projects}
          epics={epics}
          calendarEvents={calendarEvents}
        />
      ) : identity.view === 'sprint' ? (
        <SprintView
          scrumProjects={scrumProjects}
          sdlcProjects={sdlcProjects}
          allTasks={allTasks}
          profiles={profiles}
          epics={epics}
          calendarEvents={calendarEvents}
          profile={profile}
          notify={notify}
          onConvertToScrum={handleConvertToScrum}
          kanbanProjects={kanbanProjects}
        />
      ) : identity.view === 'timeline' ? (
        <TimelineView
          kanbanProjects={kanbanProjects}
          profiles={profiles}
          profile={profile}
          notify={notify}
          onRecalibrateAnalytics={() => fetchProjects()}
          onPromoteToAsset={handlePromoteTaskToAsset}
        />
      ) : (
        <BoardView
          projects={kanbanProjects}
          profiles={profiles}
          profile={profile}
          notify={notify}
          onRecalibrateAnalytics={() => fetchProjects()}
          onPromoteToAsset={handlePromoteTaskToAsset}
        />
      )}
    </main>
  );
}