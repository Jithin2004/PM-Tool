import { supabase } from '../lib/supabase';
import { activityLogService } from './activityLogService';
import { sendNotification } from './notificationService';
import { WorkConversationEngine } from '../core/system/WorkConversationEngine';
import { FollowUpEngine } from '../core/system/FollowUpEngine';

export interface TaskComment {
  id: string;
  workspace_id: string;
  task_id: string;
  author_id: string;
  content: string;
  parent_comment_id?: string;
  metadata?: any;
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
    .order('created_at', { ascending: true });

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
  // 1. Analyze comment using WorkConversationEngine
  const analysis = WorkConversationEngine.analyzeComment(content, users);
  
  // 2. Build metadata to save in db
  const commentMetadata: any = {
    is_decision: analysis.isDecision,
    has_question: analysis.hasQuestion,
    needs_response: analysis.hasQuestion ? 'Needs Response' : null
  };

  if (analysis.mentions.length > 0) {
    commentMetadata.mentions = analysis.mentions.map(m => ({
      type: 'mention',
      target_user: m.userId,
      requires_response: m.requiresResponse
    }));
  }

  // 3. Insert into DB
  const { data, error } = await supabase
    .from('task_comments')
    .insert({
      workspace_id: workspaceId,
      task_id: taskId,
      author_id: authorId,
      content,
      parent_comment_id: parentId,
      metadata: commentMetadata
    })
    .select('*, author:users(email, full_name, avatar_url)')
    .single();

  if (error) {
    console.error('Failed to create comment', error);
    return null;
  }

  // 4. Log Activity
  await activityLogService.appendLog({
    workspace_id: workspaceId,
    actor_id: authorId,
    task_id: taskId,
    action: 'comment_created',
    metadata: { comment_id: data.id, is_decision: analysis.isDecision }
  });

  // If it is a decision comment, also write to workspace settings operational_decisions or activity_log as decision_made
  if (analysis.isDecision) {
    await activityLogService.appendLog({
      workspace_id: workspaceId,
      actor_id: authorId,
      task_id: taskId,
      action: 'decision_made',
      metadata: { 
        decision_text: content,
        comment_id: data.id,
        decision_title: `Decision on Task: "${content.substring(0, 40)}..."` 
      }
    });

    // Also update project settings operational decisions blob
    try {
      const { data: workspaceData } = await supabase
        .from('workspaces')
        .select('settings')
        .eq('id', workspaceId)
        .single();
      
      const settings = workspaceData?.settings || {};
      const currentDecisions = settings.operational_decisions || [];
      const newDecision = {
        id: `dec-comment-${data.id}`,
        workspaceId,
        title: `Decision: "${content.substring(0, 45)}..."`,
        type: 'comment_decision',
        ownerId: authorId,
        ownerName: data.author?.full_name || data.author?.email || 'System User',
        ownerRole: 'member',
        affectedProjectIds: [],
        relatedBlockerIds: [],
        rationale: content,
        approvalStatus: 'approved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const updatedDecisions = [newDecision, ...currentDecisions];
      await supabase
        .from('workspaces')
        .update({ settings: { ...settings, operational_decisions: updatedDecisions } })
        .eq('id', workspaceId);
    } catch (err) {
      console.error("Failed to sync comment decision to workspace settings", err);
    }
  }

  // 5. Check for manual follow-up reminders
  const followUpDetection = FollowUpEngine.detectFollowUp(content);
  if (followUpDetection.hasReminder && followUpDetection.remindAt) {
    await FollowUpEngine.createFollowUp(
      authorId,
      'task_comment',
      data.id,
      followUpDetection.remindAt,
      followUpDetection.reason || 'Follow up on task comment'
    );
  }

  // 6. Extract @mentions and notify
  if (analysis.mentions.length > 0) {
    for (const m of analysis.mentions) {
      if (m.userId !== authorId) {
        await sendNotification(
          workspaceId,
          'assignments',
          'You were mentioned',
          `You were mentioned in a task comment: "${content.substring(0, 50)}..."`,
          m.userId
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
