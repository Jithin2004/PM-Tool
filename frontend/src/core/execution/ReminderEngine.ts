import { supabase } from '../../lib/supabase';
import { sendNotification } from '../../services/notificationService';

export interface ReminderContext {
  userId: string;
  workspaceId: string;
  tasks: any[];
  workSessions: any[];
  userTimezone?: string;
}

export class ReminderEngine {
  
  static async evaluateMorningReminders(context: ReminderContext) {
    const { userId, workspaceId, tasks } = context;
    
    // Get local hour
    const hour = new Date().getHours();
    
    // Only send morning reminder between 8 AM and 10 AM local time
    if (hour < 8 || hour > 10) return;

    // Check if we already sent a morning reminder today (we'd use a redis cache or last_notified column in reality)
    // For now, assume it's gated by the caller.

    const myPendingTasks = tasks.filter(t => t.assignee_id === userId && t.status !== 'done');
    if (myPendingTasks.length > 0) {
      await sendNotification(workspaceId, 'system', 'Morning Digest', `${myPendingTasks.length} tasks need your attention today.`, userId, { priority: 'medium' });
    }
  }

  static async evaluateDeadlineReminders(context: ReminderContext) {
    const { userId, workspaceId, tasks } = context;
    const now = Date.now();

    const myPendingTasks = tasks.filter(t => t.assignee_id === userId && t.status !== 'done' && t.end_date);

    for (const task of myPendingTasks) {
      const deadline = new Date(task.end_date).getTime();
      const hoursRemaining = (deadline - now) / (1000 * 60 * 60);

      // Trigger if deadline is between 1.5 and 2.5 hours away
      if (hoursRemaining > 1.5 && hoursRemaining <= 2.5) {
        await sendNotification(
          workspaceId, 
          'system',
          'Deadline Approaching', 
          `'${task.name}' is due in 2 hours.`, 
          userId, 
          { taskId: task.id, priority: 'high' }
        );
      }
    }
  }

  static async evaluateIdleTimerReminders(context: ReminderContext) {
    const { userId, workspaceId, workSessions } = context;
    const now = Date.now();

    const activeSession = workSessions.find(s => s.user_id === userId && !s.end_time);
    
    if (activeSession) {
      const startTime = new Date(activeSession.start_time).getTime();
      const hoursRunning = (now - startTime) / (1000 * 60 * 60);

      // If timer is running for more than 4 hours straight, remind them
      if (hoursRunning > 4) {
        await sendNotification(
          workspaceId, 
          'system',
          'Timer Still Running', 
          `You've had a timer running for over 4 hours. Did you forget to stop it?`, 
          userId, 
          { priority: 'medium' }
        );
      }
    }
  }

  static async runAll(context: ReminderContext) {
    try {
      await Promise.all([
        this.evaluateMorningReminders(context),
        this.evaluateDeadlineReminders(context),
        this.evaluateIdleTimerReminders(context)
      ]);
    } catch (e) {
      console.error("Reminder Engine Failed:", e);
    }
  }
}
