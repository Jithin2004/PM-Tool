import { supabase } from '../lib/supabase';
import { mentionEngine } from '../core/engines/mentionEngine';
import { watcherEngine } from '../core/engines/watcherEngine';
import { activityEventService } from './activityEventService';

export interface CommentReaction {
  id: string;
  comment_id: string;
  user_id: string;
  emoji: string;
}

export interface EntityComment {
  id: string;
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  parent_comment_id: string | null;
  author_id: string;
  content: string;
  mentions: any[];
  attachments: any[];
  resolved_at: string | null;
  resolved_by: string | null;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
  
  author_name?: string;
  reactions?: CommentReaction[];
  replies?: EntityComment[];
}

export const commentService = {
  async getEntityComments(entityType: string, entityId: string): Promise<EntityComment[]> {
    const { data, error } = await supabase
      .from('entity_comments')
      .select(`
        *,
        users!entity_comments_author_id_fkey ( full_name, email ),
        comment_reactions ( id, user_id, emoji )
      `)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[commentService.getEntityComments] Error:', error);
      return [];
    }

    const comments: EntityComment[] = (data || []).map((row: any) => ({
      ...row,
      author_name: row.users?.full_name || row.users?.email?.split('@')[0] || 'Unknown',
      reactions: row.comment_reactions || [],
      replies: []
    }));

    // Reconstruct 2-level threading
    const roots = comments.filter(c => !c.parent_comment_id);
    const replies = comments.filter(c => c.parent_comment_id);

    for (const reply of replies) {
      const parent = roots.find(r => r.id === reply.parent_comment_id);
      if (parent) {
        parent.replies!.push(reply);
      } else {
        // If parent is missing, treat as root for visibility
        roots.push(reply);
      }
    }

    return roots;
  },

  async createComment(
    workspaceId: string, 
    entityType: string, 
    entityId: string, 
    authorId: string, 
    authorName: string, 
    content: string, 
    parentCommentId: string | null = null
  ): Promise<EntityComment | null> {
    
    // 1. Resolve mentions
    const mentions = await mentionEngine.resolveMentions(workspaceId, content);

    // 2. Insert comment
    const { data, error } = await supabase
      .from('entity_comments')
      .insert({
        workspace_id: workspaceId,
        entity_type: entityType,
        entity_id: entityId,
        author_id: authorId,
        content: content,
        parent_comment_id: parentCommentId,
        mentions: mentions
      })
      .select()
      .single();

    if (error || !data) {
      console.error('[commentService.createComment] Error:', error);
      return null;
    }

    // 3. Trigger mention events
    if (mentions.length > 0) {
      await mentionEngine.triggerMentionEvents(mentions, data.id, entityType, entityId, authorId, authorName, workspaceId);
    }

    // 4. Trigger activity event for comment creation
    await activityEventService.recordActivity({
      workspace_id: workspaceId,
      actor_id: authorId,
      entity_type: entityType,
      entity_id: entityId,
      action_type: 'comment_created',
      metadata: {
        comment_id: data.id,
        is_reply: !!parentCommentId,
        author_name: authorName
      }
    });

    // 5. Auto-watch the entity
    await watcherEngine.autoWatch(workspaceId, entityType, entityId, authorId);

    return data as EntityComment;
  },

  async editComment(commentId: string, authorId: string, newContent: string, previousContent: string): Promise<boolean> {
    // 1. Insert audit version
    const { error: auditError } = await supabase
      .from('comment_versions')
      .insert({
        comment_id: commentId,
        edited_by: authorId,
        previous_content: previousContent
      });

    if (auditError) {
      console.error('[commentService.editComment] Audit Error:', auditError);
      return false;
    }

    // 2. Update content
    const { error } = await supabase
      .from('entity_comments')
      .update({
        content: newContent,
        edited_at: new Date().toISOString()
      })
      .eq('id', commentId)
      .eq('author_id', authorId);

    if (error) {
      console.error('[commentService.editComment] Error:', error);
      return false;
    }
    return true;
  },

  async deleteComment(commentId: string): Promise<boolean> {
    const { error } = await supabase
      .from('entity_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('[commentService.deleteComment] Error:', error);
      return false;
    }
    return true;
  },

  async resolveComment(commentId: string, userId: string, workspaceId: string, entityType: string, entityId: string): Promise<boolean> {
    const { error } = await supabase
      .from('entity_comments')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: userId
      })
      .eq('id', commentId);

    if (error) {
      console.error('[commentService.resolveComment] Error:', error);
      return false;
    }

    await activityEventService.recordActivity({
      workspace_id: workspaceId,
      actor_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      action_type: 'comment_resolved',
      metadata: { comment_id: commentId }
    });

    return true;
  },

  async addReaction(workspaceId: string, commentId: string, userId: string, emoji: string): Promise<boolean> {
    const { error } = await supabase
      .from('comment_reactions')
      .insert({
        workspace_id: workspaceId,
        comment_id: commentId,
        user_id: userId,
        emoji: emoji
      });

    if (error) {
      console.error('[commentService.addReaction] Error:', error);
      return false;
    }

    // We don't trigger a massive activity event for every reaction unless required,
    // but the spec says "Every collaboration action writes activity_events: reaction_added"
    // Let's add it but don't notify
    await activityEventService.recordActivity({
      workspace_id: workspaceId,
      actor_id: userId,
      entity_type: 'comment', // Not strictly entity level to avoid timeline spam
      entity_id: commentId,
      action_type: 'reaction_added',
      metadata: { emoji }
    });

    return true;
  },

  async removeReaction(commentId: string, userId: string, emoji: string): Promise<boolean> {
    const { error } = await supabase
      .from('comment_reactions')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .eq('emoji', emoji);

    if (error) {
      console.error('[commentService.removeReaction] Error:', error);
      return false;
    }
    return true;
  }
};
