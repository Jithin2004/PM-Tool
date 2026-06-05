import React from 'react';
import { SprintBoard } from '../scrum/SprintBoard';
import { SDLCBoard } from '../sdlc/SDLCBoard';
import { activityLogService } from '../../services/activityLogService';

interface SprintViewProps {
  scrumProjects: any[];
  sdlcProjects: any[];
  allTasks: any[];
  profiles: any[];
  epics: any[];
  calendarEvents: any[];
  profile: any;
  notify: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onConvertToScrum: (projectId: string) => Promise<void>;
  kanbanProjects: any[];
}

const SprintView = React.memo(function SprintView({
  scrumProjects, sdlcProjects, allTasks, profiles, epics,
  calendarEvents, profile, notify, onConvertToScrum, kanbanProjects
}: SprintViewProps) {
  return (
    <div className="space-y-8">
      {scrumProjects.map(project => (
        <SprintBoard
          key={project.id}
          project={project}
          projectId={project.id}
          workspaceId={project.workspace_id}
          sprints={[]}
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
          onConvertToScrum={onConvertToScrum}
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
          milestones={[]}
          approvals={[]}
          meetings={[]}
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
      {scrumProjects.length === 0 && sdlcProjects.length === 0 && (
        <div className="border border-dashed border-border py-16 text-center">
          <p className="text-sm font-mono text-text-quaternary">No Scrum or SDLC projects found</p>
        </div>
      )}
    </div>
  );
});

export default SprintView;
