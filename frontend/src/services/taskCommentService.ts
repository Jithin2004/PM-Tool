import { supabase } from '../lib/supabase';
import { activityLogService } from './activityLogService';
import { sendNotification } from './notificationService';

export interface TaskComment {
  id: string;
  workspace_id: string;
  task_id: string;
  author_id: string;
  content: string;
  parent_comment_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  author?: {
    email: string;
    full_name: string;
    avatar_url: string;
  };
}

export const fetchTaskComments = async (taskId: string): Promise<TaskComment[]> => {
  const { data, error } = await supabase
    .from('task_comments')
    .select('*, author:users(email, full_name, avatar_url)')
    .eq('task_id', taskId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true }); // Newest last in the UI means oldest first from DB and we scroll down

  if (error) {
    console.error('Failed to fetch comments', error);
    return [];
  }
  return (data || []) as TaskComment[];
};

export const createTaskComment = async (
  workspaceId: string,
  taskId: string,
  authorId: string,
  content: string,
  users: any[], // To resolve mentions
  parentId?: string
): Promise<TaskComment | null> => {
  const { data, error } = await supabase
    .from('task_comments')
    .insert({
      workspace_id: workspaceId,
      task_id: taskId,
      author_id: authorId,
      content,
      parent_comment_id: parentId
    })
    .select('*, author:users(email, full_name, avatar_url)')
    .single();

  if (error) {
    console.error('Failed to create comment', error);
    return null;
  }

  await activityLogService.appendLog({
    workspace_id: workspaceId,
    actor_id: authorId,
    task_id: taskId,
    action: 'comment_created',
    metadata: { comment_id: data.id }
  });

  // Extract @mentions and notify
  const mentions = extractMentions(content);
  if (mentions.length > 0) {
    const mentionedUsers = users.filter(u => 
      mentions.some(m => u.email?.toLowerCase().includes(m.toLowerCase()) || u.full_name?.toLowerCase().includes(m.toLowerCase()))
    );
    
    for (const u of mentionedUsers) {
      if (u.id !== authorId) {
        await sendNotification(
          workspaceId,
          u.id,
          'assignments', // or 'system'
          'You were mentioned',
          `You were mentioned in a task comment: "${content.substring(0, 50)}..."`
        );
      }
    }
  }

  return data as TaskComment;
};

export const updateTaskComment = async (
  commentId: string,
  content: string,
  workspaceId: string,
  authorId: string,
  taskId: string
): Promise<boolean> => {
  const { error } = await supabase
    .from('task_comments')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', commentId);

  if (error) return false;

  await activityLogService.appendLog({
    workspace_id: workspaceId,
    actor_id: authorId,
    task_id: taskId,
    action: 'comment_edited',
    metadata: { comment_id: commentId }
  });

  return true;
};

export const archiveTaskComment = async (
  commentId: string,
  workspaceId: string,
  authorId: string,
  taskId: string
): Promise<boolean> => {
  const { error } = await supabase
    .from('task_comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', commentId);

  if (error) return false;

  await activityLogService.appendLog({
    workspace_id: workspaceId,
    actor_id: authorId,
    task_id: taskId,
    action: 'comment_archived',
    metadata: { comment_id: commentId }
  });

  return true;
};

function extractMentions(text: string): string[] {
  const regex = /@([a-zA-Z0-9_.-]+)/g;
  const matches = text.match(regex);
  if (!matches) return [];
  return matches.map(m => m.substring(1));
}
