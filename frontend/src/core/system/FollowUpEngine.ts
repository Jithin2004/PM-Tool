import { supabase } from '../../lib/supabase';

export interface FollowUpReminder {
  hasReminder: boolean;
  remindAt: Date | null;
  reason: string | null;
}

export const FollowUpEngine = {
  /**
   * Parses text content to detect manual follow-up reminder keywords.
   */
  detectFollowUp(content: string): FollowUpReminder {
    const text = content.trim();
    const lower = text.toLowerCase();
    
    let remindAt: Date | null = null;
    let reason: string | null = null;
    let hasReminder = false;

    const now = new Date();

    // 1. "remind me tomorrow" / "check tomorrow"
    if (lower.includes('remind me tomorrow') || lower.includes('check tomorrow') || lower.includes('remind tomorrow')) {
      hasReminder = true;
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0); // 9:00 AM tomorrow
      remindAt = tomorrow;
      reason = "Follow up tomorrow";
    }
    // 2. "waiting until friday" / "remind me friday" / "check on friday"
    else if (lower.includes('until friday') || lower.includes('remind me friday') || lower.includes('check on friday') || lower.includes('waiting friday')) {
      hasReminder = true;
      const friday = new Date(now);
      const dayOfWeek = friday.getDay(); // 0 is Sunday, 5 is Friday
      let daysToAdd = 5 - dayOfWeek;
      if (daysToAdd <= 0) daysToAdd += 7; // Next Friday
      friday.setDate(friday.getDate() + daysToAdd);
      friday.setHours(9, 0, 0, 0);
      remindAt = friday;
      reason = "Follow up on Friday";
    }
    // 3. "need to check later" / "check later" / "remind me later"
    else if (lower.includes('check later') || lower.includes('remind me later') || lower.includes('check this later')) {
      hasReminder = true;
      const later = new Date(now);
      later.setHours(later.getHours() + 4); // 4 hours later
      remindAt = later;
      reason = "Follow up later today";
    }
    // 4. Relative reminders e.g., "remind me in 3 days", "remind me in 2 hours"
    else {
      const match = lower.match(/remind me in (\d+)\s*(hour|day|week)s?/i);
      if (match) {
        hasReminder = true;
        const count = parseInt(match[1], 10);
        const unit = match[2];
        const relativeDate = new Date(now);
        
        if (unit.startsWith('hour')) {
          relativeDate.setHours(relativeDate.getHours() + count);
        } else if (unit.startsWith('day')) {
          relativeDate.setDate(relativeDate.getDate() + count);
        } else if (unit.startsWith('week')) {
          relativeDate.setDate(relativeDate.getDate() + count * 7);
        }
        
        remindAt = relativeDate;
        reason = `Follow up in ${count} ${unit}(s)`;
      }
    }

    return {
      hasReminder,
      remindAt,
      reason: hasReminder ? `${reason}: "${text.substring(0, 40)}${text.length > 40 ? '...' : ''}"` : null
    };
  },

  /**
   * Inserts a reminder record into the database.
   */
  async createFollowUp(
    ownerId: string,
    sourceType: 'task_comment' | 'task' | 'project',
    sourceId: string,
    remindAt: Date,
    reason: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('follow_ups')
        .insert({
          created_by_id: ownerId,
          source_type: sourceType,
          source_id: sourceId,
          remind_at: remindAt.toISOString(),
          reason,
          completed: false
        });

      if (error) {
        console.error('Failed to create follow-up reminder', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Error in createFollowUp', e);
      return false;
    }
  },

  /**
   * Fetches pending reminders for a specific owner.
   */
  async fetchFollowUps(ownerId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('follow_ups')
        .select('*')
        .eq('created_by_id', ownerId)
        .order('completed', { ascending: true })
        .order('remind_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('Failed to fetch follow-ups', e);
      return [];
    }
  },

  /**
   * Marks a reminder completed in the database.
   */
  async completeFollowUp(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('follow_ups')
        .update({ completed: true })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Failed to complete follow-up', e);
      return false;
    }
  },

  /**
   * Deletes a reminder from the database.
   */
  async deleteFollowUp(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('follow_ups')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Failed to delete follow-up', e);
      return false;
    }
  }
};
