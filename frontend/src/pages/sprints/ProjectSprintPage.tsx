import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useTasks } from '../../hooks/useTasks';
import { useCalendarEvents } from '../../hooks/useCalendarEvents';
import { activityLogService } from '../../services/activityLogService';
import SprintView from '../../components/execution/SprintView';

function getProjectIdFromPath(): string | null {
  const segments = window.location.pathname.split('/');
  if (segments[1] === 'projects' && segments[2]) return segments[2];
  return null;
}

export default function ProjectSprintPage() {
  const projectId = getProjectIdFromPath();
  const { profile } = useAuth();
  const { workspace } = useWorkspace();
  const { tasks: allTasks } = useTasks(workspace?.id);
  const { projects, profiles, notify, fetchProjects, updateExecutionMode, epics } = useDashboard();
  const { events: calendarEvents } = useCalendarEvents(workspace?.id);

  const project = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);

  const scrumProjects = useMemo(() =>
    project?.execution_mode === 'SCRUM' || project?.execution_mode === 'HYBRID' ? [project] : [],
  [project]);

  const sdlcProjects = useMemo(() =>
    project?.execution_mode === 'SDLC' ? [project] : [],
  [project]);

  const kanbanProjects = useMemo(() =>
    project?.execution_mode === 'KANBAN' ? [project] : [],
  [project]);

  const handleConvertToScrum = async (id: string) => {
    if (!updateExecutionMode) return;
    await updateExecutionMode(id, 'SCRUM');
    await activityLogService.appendLog({
      workspace_id: project?.workspace_id || '',
      actor_id: profile?.id, project_id: id,
      action: 'converted_to_scrum',
      metadata: { previous_mode: 'KANBAN', new_mode: 'SCRUM' }
    });
    fetchProjects();
  };

  return (
    <main className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12">
      <div className="flex justify-between items-center mb-8 bg-[#090a0f]/40 border border-white/10 p-4 rounded-lg backdrop-blur-md">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">{project?.name || 'Project'} — Sprints</h2>
          <p className="text-[10px] font-mono text-white/50 uppercase">Sprint planning · velocity · retrospectives</p>
        </div>
      </div>
      <SprintView
        scrumProjects={scrumProjects}
        sdlcProjects={sdlcProjects}
        allTasks={allTasks}
        profiles={profiles}
        epics={epics || []}
        calendarEvents={calendarEvents}
        profile={profile}
        notify={notify}
        onConvertToScrum={handleConvertToScrum}
        kanbanProjects={kanbanProjects}
      />
    </main>
  );
}
