import { Task, Profile } from '../../types';
import { generateWaitingStates } from '../waiting/WaitingStateEngine';

export type NotificationPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface WorkInboxItem {
  id: string;
  type: 'mention' | 'approval' | 'assigned_task' | 'blocker_request';
  title: string;
  description?: string;
  actionRequired: boolean;
  actionRoute: string;
  timestamp: string;
  priority: NotificationPriority;
  metadata?: any;
}

export interface WorkInboxInputs {
  userId: string;
  tasks: Task[];
  projects: any[];
  approvals: any[];
  notifications: any[]; // Expecting notification_events
  workspaceSettingsBlob: any;
  profiles: Profile[];
}

export function generateWorkInbox(inputs: WorkInboxInputs): WorkInboxItem[] {
  const { userId, tasks, projects, approvals, notifications, workspaceSettingsBlob, profiles } = inputs;
  const items: WorkInboxItem[] = [];

  const now = new Date();
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(now.getDate() + 3);

  // 1. Assigned Tasks (Actionable if urgent/high OR due soon)
  const userTasks = tasks.filter(t => t.assignee_id === userId && t.status !== 'done');
  userTasks.forEach(t => {
    const isUrgent = t.priority === 'urgent' || t.priority === 'high';
    const isDueSoon = t.deadline && new Date(t.deadline) <= threeDaysFromNow;
    
    if (isUrgent || isDueSoon) {
      items.push({
        id: `task_${t.id}`,
        type: 'assigned_task',
        title: t.name,
        description: `Task requires your attention (${t.priority || 'standard'} priority)`,
        actionRequired: true,
        actionRoute: `/execution/board`,
        timestamp: t.updated_at || t.created_at || new Date().toISOString(),
        priority: isUrgent ? 'HIGH' : 'MEDIUM',
        metadata: { taskId: t.id, projectId: t.project_id }
      });
    }
  });

  // 2. Approvals
  const userApprovals = approvals.filter(a => a.requested_from === userId && a.status === 'pending');
  userApprovals.forEach(a => {
    items.push({
      id: `approval_${a.id}`,
      type: 'approval',
      title: 'Approval Required',
      description: a.reason || `Please review ${a.entity_type}`,
      actionRequired: true,
      actionRoute: `/workspace/approvals`,
      timestamp: a.created_at,
      priority: 'HIGH',
      metadata: { approvalId: a.id }
    });
  });

  // 3. Blocker Requests & Waiting States
  const executionBlockers = workspaceSettingsBlob?.execution_blockers || [];
  
  const waitingStates = generateWaitingStates({
    userId,
    role: 'developer', // Inbox shows personal actionable items
    tasks,
    projects,
    approvals,
    blockers: executionBlockers,
    profiles
  });

  waitingStates.forEach(ws => {
    if (ws.waitingForUserId === userId) {
      items.push({
        id: `waiting_${ws.id}`,
        type: 'blocker_request',
        title: ws.title,
        description: `Waiting on you: ${ws.waitingReason}`,
        actionRequired: true,
        actionRoute: ws.actionRoute,
        timestamp: ws.waitingSince,
        priority: ws.severity === 'critical' ? 'CRITICAL' : 'HIGH',
        metadata: { taskId: ws.affectedTasks[0]?.id }
      });
    }
  });

  // 4. Notifications & Mentions (from notification_events)
  const unreadNotifications = notifications.filter(n => n.recipient_id === userId && !n.read_at);
  unreadNotifications.forEach(n => {
    const isMention = n.category === 'system' && n.title.toLowerCase().includes('mention');
    
    // Map db priority to inbox priority
    let pri: NotificationPriority = 'MEDIUM';
    if (n.priority === 'critical') pri = 'CRITICAL';
    else if (n.priority === 'high') pri = 'HIGH';
    else if (n.priority === 'low') pri = 'LOW';

    // Rule: If user must act, show it. If info only, hide it.
    if (isMention || pri === 'CRITICAL' || pri === 'HIGH') {
      items.push({
        id: `notif_${n.id}`,
        type: isMention ? 'mention' : 'notification' as any,
        title: n.title,
        description: n.message || n.body,
        actionRequired: true,
        actionRoute: n.action_url || `/execution/board`,
        timestamp: n.created_at,
        priority: isMention ? 'HIGH' : pri,
        metadata: { notificationId: n.id }
      });
    }
  });

  // Sort by priority (CRITICAL > HIGH > MEDIUM) then by recency
  const priorityWeight = { 'CRITICAL': 3, 'HIGH': 2, 'MEDIUM': 1, 'LOW': 0 };
  
  items.sort((a, b) => {
    const weightDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
    if (weightDiff !== 0) return weightDiff;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return items;
}
