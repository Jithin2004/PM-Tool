import React from 'react';
import { SprintBoard } from '../scrum/SprintBoard';
import { SDLCBoard } from '../sdlc/SDLCBoard';
import { activityLogService } from '../../services/activityLogService';
import { updateTaskWithLock } from '../../services/taskService';
import { EmptyState } from '../core';
import { Rocket } from 'lucide-react';

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
            const currentTask = allTasks.find(t => t.id === taskId);
            const expectedUpdatedAt = currentTask?.updated_at || null;
            
            const { success, error } = await updateTaskWithLock(taskId, { status }, expectedUpdatedAt);
            
            if (!success) {
              if (error === 'VERSION_CONFLICT') {
                notify("This task changed recently. Refreshing latest version.", "warning");
              } else {
                notify(`Failed to update task: ${error}`, "error");
              }
              return; // abort if failed
            }

            await activityLogService.appendLog({
              workspace_id: project.workspace_id, actor_id: profile?.id,
              project_id: project.id, task_id: taskId, action_type: 'task_status_changed',
              metadata: { new_status: status }
            });
          }}
          onCreateTask={async (taskData) => {
            const { supabase } = await import('../../lib/supabase');
            const { data } = await supabase.from('tasks').insert({ ...taskData, workspace_id: project.workspace_id }).select().single();
            if (data) {
              await activityLogService.appendLog({
                workspace_id: project.workspace_id, actor_id: profile?.id,
                project_id: project.id, task_id: data.id, action_type: 'task_created',
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
                project_id: project.id, action_type: 'sprint_created',
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
            const currentTask = allTasks.find(t => t.id === taskId);
            const expectedUpdatedAt = currentTask?.updated_at || null;
            
            const { success, error } = await updateTaskWithLock(taskId, { status }, expectedUpdatedAt);
            
            if (!success) {
              if (error === 'VERSION_CONFLICT') {
                notify("This task changed recently. Refreshing latest version.", "warning");
              } else {
                notify(`Failed to update task: ${error}`, "error");
              }
            }
          }}
          onCreateTask={async (taskData) => {
            const { supabase } = await import('../../lib/supabase');
            await supabase.from('tasks').insert({ ...taskData, workspace_id: project.workspace_id });
          }}
        />
      ))}
      {scrumProjects.length === 0 && sdlcProjects.length === 0 && (
        <div className="max-w-md mx-auto mt-12">
          <EmptyState
            icon={Rocket}
            title="No Active Sprints"
            description="Scrum and SDLC projects will appear here for sprint and iteration planning."
          />
        </div>
      )}
    </div>
  );
});

export default SprintView;
