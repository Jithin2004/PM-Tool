import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Epic, Story } from '../core/types/cycle';
import { Task } from '../core/types/execution';

export interface BacklogData {
  inbox: Task[];
  epics: Array<{
    epic: Epic;
    stories: Array<{
      story: Story;
      tasks: Task[];
    }>;
    standalone_tasks: Task[];
  }>;
}

export const backlogService = {
  async getProjectBacklog(projectId: string): Promise<BacklogData | null> {
    if (!isSupabaseConfigured) return null;
    
    try {
      // Fetch all relevant data concurrently
      const [
        { data: epics },
        { data: stories },
        { data: tasks }
      ] = await Promise.all([
        supabase.from('epics').select('*').eq('project_id', projectId).is('deleted_at', null).order('created_at'),
        supabase.from('stories').select('*').eq('project_id', projectId).order('created_at'),
        supabase.from('tasks').select('id, title, status, project_id, assigned_to').eq('project_id', projectId).is('deleted_at', null).order('created_at')
      ]);

      const result: BacklogData = {
        inbox: [],
        epics: []
      };

      if (!tasks) return result;

      // Group tasks
      const inboxTasks = tasks.filter(t => !t.epic_id && !t.story_id);
      result.inbox = inboxTasks;

      if (epics) {
        epics.forEach(epic => {
          const epicStories = (stories || []).filter(s => s.epic_id === epic.id);
          const epicTasks = tasks.filter(t => t.epic_id === epic.id);

          const storiesWithTasks = epicStories.map(story => {
            return {
              story,
              tasks: epicTasks.filter(t => t.story_id === story.id)
            };
          });

          // Tasks that belong to the epic but not to any story
          const standaloneEpicTasks = epicTasks.filter(t => !t.story_id);

          result.epics.push({
            epic,
            stories: storiesWithTasks,
            standalone_tasks: standaloneEpicTasks
          });
        });
      }

      return result;
    } catch (err) {
      console.error('[backlogService.getProjectBacklog] Error:', err);
      return null;
    }
  }
};
