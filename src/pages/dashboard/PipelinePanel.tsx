import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useTasks } from '../../hooks/useTasks';
import ExecutionBoard from '../../components/ExecutionBoard';
import { GanttView } from '../../components/gantt/GanttView';
import { SprintBoard } from '../../components/scrum/SprintBoard';
import { SDLCBoard } from '../../components/sdlc/SDLCBoard';
import { activityLogService } from '../../services/activityLogService';
import { useCalendarEvents } from '../../hooks/useCalendarEvents';
import type { Milestone, Approval, Meeting, Epic, Sprint, Project } from '../../types';

export function PipelinePanel() {
  const { profile } = useAuth();
  const { workspace } = useWorkspace();
  const { tasks: allTasks } = useTasks(workspace?.id);
  const [viewMode, setViewMode] = useState<'board' | 'gantt'>('board');
  const { 
    projects, 
    profiles, 
    notify, 
    fetchProjects, 
    handlePromoteTaskToAsset,
    updateExecutionMode
  } = useDashboard();

  const [milestones] = useState<Milestone[]>([]);
  const [approvals] = useState<Approval[]>([]);
  const [meetings] = useState<Meeting[]>([]);
  const [epics] = useState<Epic[]>([]);
  const [sprints] = useState<Sprint[]>([]);
  const { events: calendarEvents } = useCalendarEvents(workspace?.id);

  React.useEffect(() => {
    const handleSwitch = () => setViewMode('board');
    window.addEventListener('switch-to-board', handleSwitch);
    return () => window.removeEventListener('switch-to-board', handleSwitch);
  }, []);

  const kanbanProjects = projects.filter(p => p.execution_mode === 'KANBAN');
  const scrumProjects = projects.filter(p => p.execution_mode === 'SCRUM');
  const sdlcProjects = projects.filter(p => p.execution_mode === 'SDLC');

  const handleConvertToScrum = async (projectId: string) => {
    if (!updateExecutionMode) return;
    await updateExecutionMode(projectId, 'SCRUM');
    await activityLogService.appendLog({
      workspace_id: projects.find(p => p.id === projectId)?.workspace_id || '',
      actor_id: profile?.id,
      project_id: projectId,
      action: 'converted_to_scrum',
      metadata: { previous_mode: 'KANBAN', new_mode: 'SCRUM' }
    });
    fetchProjects();
  };

  return (
    <main className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12">
      <div className="flex justify-between items-center mb-8 bg-[#090a0f]/40 border border-white/10 p-4 rounded-lg backdrop-blur-md">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Execution Board</h2>
          <p className="text-[10px] font-mono text-white/50 uppercase">Kanban · Scrum · Hybrid workflow execution</p>
        </div>
        <div className="flex bg-black/40 border border-white/10 p-0.5 rounded-sm gap-0.5">
          <button onClick={() => setViewMode('board')} className={`px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-sm transition-all cursor-pointer ${viewMode === 'board' ? 'bg-blue-600/30 text-blue-400 border border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.15)]' : 'text-white/60 hover:text-white border border-transparent'}`}>Board</button>
          <button onClick={() => setViewMode('gantt')} className={`px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-sm transition-all cursor-pointer ${viewMode === 'gantt' ? 'bg-blue-600/30 text-blue-400 border border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.15)]' : 'text-white/60 hover:text-white border border-transparent'}`}>Gantt</button>
        </div>
      </div>

      {viewMode === 'board' ? (
        <div className="space-y-8">
          <ExecutionBoard
            projects={kanbanProjects}
            users={profiles}
            currentUserProfile={profile}
            notify={notify}
            onRecalibrateAnalytics={() => fetchProjects()}
            onPromoteToAsset={handlePromoteTaskToAsset}
          />

          {scrumProjects.map(project => (
            <SprintBoard
              key={project.id}
              projectId={project.id}
              workspaceId={project.workspace_id}
              sprints={sprints.filter(s => s.project_id === project.id)}
              tasks={allTasks}
              users={profiles}
              epics={epics.filter(e => e.project_id === project.id)}
              calendarEvents={calendarEvents}
              currentUserProfile={profile}
              notify={notify}
              onUpdateTaskStatus={async (taskId, status) => {
                const { supabase } = await import('../../lib/supabase');
                await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', taskId);
                await activityLogService.appendLog({
                  workspace_id: project.workspace_id, actor_id: profile?.id,
                  project_id: project.id, task_id: taskId, action: 'task_status_changed',
                  metadata: { new_status: status }
                });
              }}
              onCreateTask={async (taskData) => {
                const { supabase } = await import('../../lib/supabase');
                const { data } = await supabase.from('tasks').insert({ ...taskData, workspace_id: project.workspace_id }).select().single();
                if (data) {
                  await activityLogService.appendLog({
                    workspace_id: project.workspace_id, actor_id: profile?.id,
                    project_id: project.id, task_id: data.id, action: 'task_created',
                    metadata: { name: taskData.name }
                  });
                }
              }}
              onCreateSprint={async (sprint) => {
                const { supabase } = await import('../../lib/supabase');
                const { data } = await supabase.from('sprints').insert(sprint).select().single();
                if (data) {
                  await activityLogService.appendLog({
                    workspace_id: project.workspace_id, actor_id: profile?.id,
                    project_id: project.id, action: 'sprint_created',
                    metadata: { sprint_name: sprint.name }
                  });
                }
              }}
              onConvertToScrum={handleConvertToScrum}
              allKanbanProjects={kanbanProjects}
            />
          ))}

          {sdlcProjects.map(project => (
            <SDLCBoard
              key={project.id}
              project={project}
              workspaceId={project.workspace_id}
              tasks={allTasks}
              users={profiles}
              milestones={milestones.filter(m => m.project_id === project.id)}
              approvals={approvals.filter(a => a.project_id === project.id)}
              meetings={meetings.filter(m => m.project_id === project.id)}
              currentUserProfile={profile}
              notify={notify}
              onUpdateTaskStatus={async (taskId, status) => {
                const { supabase } = await import('../../lib/supabase');
                await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', taskId);
              }}
              onCreateTask={async (taskData) => {
                const { supabase } = await import('../../lib/supabase');
                await supabase.from('tasks').insert({ ...taskData, workspace_id: project.workspace_id });
              }}
            />
          ))}
        </div>
      ) : (
        <GanttView milestones={milestones} meetings={meetings} projects={projects} epics={epics} calendarEvents={calendarEvents} />
      )}
    </main>
  );
}
