import { supabase } from '../../lib/supabase';
import { activityEventService } from '../../services/activityEventService';
import { workspaceMemberCache } from './workspaceMemberCache';

export interface MentionData {
  user_id: string;
  display_name: string;
}

export const mentionEngine = {
  /**
   * Parse content for @mentions and resolve them to user IDs.
   * Returns the array of valid mentions found in the workspace.
   */
  async resolveMentions(workspaceId: string, content: string): Promise<MentionData[]> {
    // Basic regex for @[Display Name](id) or just trying to match display names
    // For a lightweight implementation, we might just look for @Word patterns
    // and match against user profiles if we don't have a structured ID format in text.
    // Assuming the frontend MentionTextarea inserts structured text like `@username `
    
    const mentionMatches = content.match(/@([a-zA-Z0-9_.-]+)/g);
    if (!mentionMatches || mentionMatches.length === 0) return [];

    const usernames = mentionMatches.map(m => m.substring(1)); // strip '@'
    
    // Try cache first for instant resolution
    let users = workspaceMemberCache.getMembers(workspaceId);
    if (!users || users.length === 0) {
      users = await workspaceMemberCache.hydrate(workspaceId);
    }

    const resolved: MentionData[] = [];
    
    // Naive matching: match @firstName_lastName or @emailPrefix
    usernames.forEach(uname => {
      const unameLower = uname.toLowerCase();
      const matchedUser = users.find(u => {
        const emailPrefix = u.email.split('@')[0].toLowerCase();
        const nameJoined = (u.full_name || '').replace(/\s+/g, '').toLowerCase();
        return emailPrefix === unameLower || nameJoined === unameLower || (u.full_name || '').toLowerCase() === unameLower;
      });
      
      if (matchedUser && !resolved.some(r => r.user_id === matchedUser.id)) {
        resolved.push({
          user_id: matchedUser.id,
          display_name: matchedUser.full_name || matchedUser.email.split('@')[0]
        });
      }
    });

    return resolved;
  },

  /**
   * Trigger activity events for each mentioned user.
   */
  async triggerMentionEvents(mentions: MentionData[], commentId: string, entityType: string, entityId: string, authorId: string, authorName: string, workspaceId: string) {
    if (!mentions || mentions.length === 0) return;

    for (const mention of mentions) {
      if (mention.user_id === authorId) continue; // Don't notify self

      await activityEventService.recordActivity({
        workspace_id: workspaceId,
        actor_id: authorId,
        entity_type: entityType,
        entity_id: entityId,
        action_type: 'mention', // notificationEngine expects 'mention'
        metadata: {
          comment_id: commentId,
          mentioned_user_id: mention.user_id,
          mentioned_user_name: mention.display_name,
          author_name: authorName
        }
      });
    }
  }
};
