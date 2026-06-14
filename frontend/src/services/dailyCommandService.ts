import { supabase } from '../lib/supabase';
import { UserRole } from '../types';
import { profitabilityService } from './profitabilityService';

export interface ActionableItem {
  id: string;
  title: string;
  subtitle?: string;
  priority: 'High' | 'Normal' | 'Low';
  actionRoute: string;
  actionLabel: string;
}

export interface Recommendation {
  id: string;
  message: string;
  type: 'action' | 'info' | 'urgent' | 'focus';
  actionRoute?: string;
}

export interface DailyIntelligence {
  greeting: { message: string; subMessage: string };
  primaryFocus: Recommendation | null;
  attentionItems: ActionableItem[];
  recentChanges: { id: string; description: string; time: string }[];
  upcomingDeadlines: ActionableItem[];
  recommendations: Recommendation[];
}

export async function getDailyIntelligence(userId: string, workspaceId: string, role: UserRole, userName: string): Promise<DailyIntelligence> {
  const firstName = userName.split(' ')[0] || 'there';
  
  const baseIntelligence: DailyIntelligence = {
    greeting: { message: `Good morning, ${firstName} 👋`, subMessage: "Here's what you need to know today." },
    primaryFocus: null,
    attentionItems: [],
    recentChanges: [],
    upcomingDeadlines: [],
    recommendations: []
  };

  try {
    // Determine if it's a completely fresh workspace by doing a quick count on projects
    const { count: projectCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    if (projectCount === 0 && role !== 'viewer' && role !== 'client') {
      baseIntelligence.greeting.message = `Welcome to Resolve PM, ${firstName} 👋`;
      baseIntelligence.greeting.subMessage = "Let's get your operational workspace set up.";
      baseIntelligence.primaryFocus = {
        id: 'setup-1',
        message: 'Your workspace is empty. Recommended next step: Create your first project.',
        type: 'action',
        actionRoute: '/workspace'
      };
      baseIntelligence.recommendations = [
        { id: 'rec-1', message: 'Invite your team members to collaborate.', type: 'action', actionRoute: '/settings' },
        { id: 'rec-2', message: 'Configure your company calendar and working days.', type: 'action', actionRoute: '/settings' }
      ];
      return baseIntelligence;
    }

    // Call the centralized RPC (Batch 6C Scale Architecture)
    const { data: metrics } = await supabase.rpc('get_my_daily_command', {
      p_user_id: userId,
      p_workspace_id: workspaceId,
      p_role: role
    });

    const m = (metrics as any) || { today_tasks: 0, blockers: 0, approvals: 0, mentions: 0, recent_changes: 0, waiting_on_me: 0 };

    // Role-specific routing
    if (role === 'developer' || role === 'viewer') {
      await populateDeveloperIntelligence(userId, workspaceId, baseIntelligence, m);
    } 
    else if (role === 'pm') {
      await populatePMIntelligence(userId, workspaceId, baseIntelligence, m);
    } 
    else if (role === 'super_admin' || role === 'admin' || role === 'founder') {
      await populateFounderIntelligence(workspaceId, baseIntelligence, m);
    }
    else if (role === 'hr' || role === 'finance') {
      await populateAdminSupportIntelligence(workspaceId, role, baseIntelligence, m);
    }
    else if (role === 'client') {
      await populateClientIntelligence(userId, workspaceId, baseIntelligence, m);
    }

  } catch (err) {
    console.error('[DailyIntelligence] Failed to fetch data:', err);
  }

  return baseIntelligence;
}

// ==========================================
// ADAPTERS (Using RPC Metrics instead of unbounded queries)
// ==========================================

async function populateDeveloperIntelligence(userId: string, workspaceId: string, i: DailyIntelligence, m: any) {
  i.greeting.subMessage = "Here's what you should do today.";

  if (m.blockers > 0) {
    i.primaryFocus = {
      id: 'focus-blocked',
      message: `You have ${m.blockers} blocked task(s). Focus on resolving blockers.`,
      type: 'urgent',
      actionRoute: '/board'
    };
    i.attentionItems.push({
      id: 'dev-blocked',
      title: `${m.blockers} Blocked Tasks`,
      subtitle: `Action required to unblock execution.`,
      priority: 'High',
      actionLabel: 'Resolve',
      actionRoute: '/board'
    });
  } else if (m.today_tasks > 0) {
    i.primaryFocus = {
      id: 'focus-top',
      message: `You have ${m.today_tasks} active task(s). Continue working.`,
      type: 'focus',
      actionRoute: '/board'
    };
  } else {
    i.primaryFocus = {
      id: 'focus-idle',
      message: 'You have no active tasks. Pull a new task from the backlog.',
      type: 'info',
      actionRoute: '/board'
    };
  }

  if (m.waiting_on_me > 0) {
    i.upcomingDeadlines.push({
      id: 'wait-states',
      title: 'Wait States',
      subtitle: `${m.waiting_on_me} items are waiting on you.`,
      priority: 'High',
      actionLabel: 'Review',
      actionRoute: '/board'
    });
  }

  if (m.recent_changes > 0) {
    i.recentChanges.push({
      id: 'recent-dev',
      description: `${m.recent_changes} tasks updated recently.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  }
}

async function populatePMIntelligence(userId: string, workspaceId: string, i: DailyIntelligence, m: any) {
  i.greeting.subMessage = "Here's what needs your attention today.";

  if (m.blockers > 0) {
    i.primaryFocus = {
      id: 'focus-risk',
      message: `${m.blockers} project(s) are At Risk or Delayed. Review capacity and bottlenecks.`,
      type: 'urgent',
      actionRoute: '/workspace'
    };

    i.attentionItems.push({
      id: 'pm-at-risk',
      title: `${m.blockers} Projects At Risk`,
      subtitle: `Drift or high risk detected.`,
      priority: 'High',
      actionLabel: 'Diagnose',
      actionRoute: '/workspace'
    });
  } else if (m.today_tasks > 0) {
    i.primaryFocus = {
      id: 'focus-healthy',
      message: `Your ${m.today_tasks} projects are currently healthy. Review team workload balance.`,
      type: 'focus',
      actionRoute: '/workspace'
    };
  }

  if (m.approvals > 0) {
    i.upcomingDeadlines.push({
      id: 'pm-approvals',
      title: 'Pending Approvals',
      subtitle: `${m.approvals} approvals require your sign-off.`,
      priority: 'Normal',
      actionLabel: 'Review',
      actionRoute: '/overview'
    });
  }

  if (m.recent_changes > 0) {
    i.recentChanges.push({
      id: 'recent-pm',
      description: `${m.recent_changes} tasks or projects updated recently.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  }

  if (m.waiting_on_me > 0) {
    i.upcomingDeadlines.push({
      id: 'wait-states',
      title: 'Wait States',
      subtitle: `${m.waiting_on_me} items are waiting on you.`,
      priority: 'High',
      actionLabel: 'Review',
      actionRoute: '/board'
    });
  }
}

async function populateFounderIntelligence(workspaceId: string, i: DailyIntelligence, m: any) {
  i.greeting.subMessage = "Company pulse and operational health.";

  // Use the optimized RPC
  const { data: summary } = await supabase.rpc('get_workspace_operational_summary', { p_workspace_id: workspaceId });

  if (summary) {
    const { active_projects, overdue_tasks, blocked_tasks, server_metrics } = summary as any;

    if (server_metrics.riskForecast > 50) {
      i.primaryFocus = {
        id: 'focus-critical',
        message: `High organizational risk detected (${server_metrics.riskForecast}%). Delivery confidence is critically low.`,
        type: 'urgent',
        actionRoute: '/workspace'
      };
    } else {
      i.primaryFocus = {
        id: 'focus-stable',
        message: `Operations are stable. Delivery confidence is at ${server_metrics.deliveryConfidence}%.`,
        type: 'focus',
        actionRoute: '/workspace'
      };
    }

    if (blocked_tasks > 0) {
      i.attentionItems.push({
        id: 'org-blocked',
        title: 'System Bottleneck',
        subtitle: `${blocked_tasks} tasks are globally blocked across ${active_projects} active projects.`,
        priority: 'High',
        actionLabel: 'Investigate',
        actionRoute: '/workspace'
      });
    }

    if (overdue_tasks > 0) {
      i.attentionItems.push({
        id: 'org-overdue',
        title: 'Delivery Slippage',
        subtitle: `${overdue_tasks} active tasks have breached their deadlines.`,
        priority: 'Normal',
        actionLabel: 'Review',
        actionRoute: '/workspace'
      });
    }
  }
  
  if (m.approvals > 0) {
    i.attentionItems.push({
      id: 'org-finance',
      title: 'Financial Pulse',
      subtitle: `${m.approvals} pending invoices need processing.`,
      priority: 'Normal',
      actionLabel: 'Finance',
      actionRoute: '/finance'
    });
  }
}

async function populateAdminSupportIntelligence(workspaceId: string, role: string, i: DailyIntelligence, m: any) {
  i.greeting.subMessage = "Logistics and operational support.";

  if (role === 'hr') {
    i.primaryFocus = {
      id: 'hr-focus',
      message: 'Review personnel changes and pending leave requests.',
      type: 'info',
      actionRoute: '/settings'
    };
  } else if (role === 'finance') {
    if (m.approvals > 0) {
      i.primaryFocus = {
        id: 'fin-focus',
        message: `${m.approvals} invoices require attention (Draft or Overdue).`,
        type: 'urgent',
        actionRoute: '/finance'
      };
    } else {
      i.primaryFocus = {
        id: 'fin-focus',
        message: 'No pending invoices. Financial records are up to date.',
        type: 'focus',
        actionRoute: '/finance'
      };
    }
  }
}

async function populateClientIntelligence(userId: string, workspaceId: string, i: DailyIntelligence, m: any) {
  i.greeting.subMessage = "Here is the progress on your projects.";

  const { data: milestones } = await supabase
    .from('milestones')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'client_review');

  if (milestones && milestones.length > 0) {
    i.primaryFocus = {
      id: 'client-review-focus',
      message: `You have ${milestones.length} deliverable(s) waiting for your review.`,
      type: 'urgent',
      actionRoute: '/workspace/portfolio'
    };
  } else {
    i.primaryFocus = {
      id: 'client-focus',
      message: `You have ${m.today_tasks} active projects in delivery.`,
      type: 'focus',
      actionRoute: '/workspace/portfolio'
    };
  }
}
