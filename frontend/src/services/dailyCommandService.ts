import { supabase } from '../lib/supabase';
import { UserRole } from '../types';
import { profitabilityService } from './profitabilityService';
import { getAuthorityRank, hasFunction, hasCapability } from '../core/auth/permissions';
import { intelligenceQueryEngine } from '../core/engines/intelligenceQueryEngine';

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

export async function getDailyIntelligence(userId: string, workspaceId: string, profile: any): Promise<DailyIntelligence> {
  const userName = profile?.full_name || profile?.email || 'User';
  const role = profile?.role;
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
    const { count: projectCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    if (projectCount === 0 && role !== 'viewer' && role !== 'client') {
      baseIntelligence.greeting.message = `Welcome to Resolve PM, ${firstName} 👋`;
      baseIntelligence.greeting.subMessage = "Let's get your operational workspace set up.";
      baseIntelligence.primaryFocus = {
        id: 'setup-1',
        message: 'Your command center is ready. Create projects and invite your team to start receiving operational intelligence.',
        type: 'action',
        actionRoute: 'modal:create-project'
      };
      baseIntelligence.recommendations = [
        { id: 'rec-1', message: 'Invite your team members to collaborate.', type: 'action', actionRoute: 'modal:invite-members' },
        { id: 'rec-2', message: 'Configure your company calendar and working days.', type: 'action', actionRoute: '/control/settings' }
      ];
      return baseIntelligence;
    }

    const { data: metrics } = await supabase.rpc('get_my_daily_command', {
      p_user_id: userId,
      p_workspace_id: workspaceId,
      p_role: role
    });

    const m = (metrics as any) || { today_tasks: 0, blockers: 0, approvals: 0, mentions: 0, recent_changes: 0, waiting_on_me: 0 };
    const rank = getAuthorityRank(role);

    // Fetch real intelligence
    const deliveryHealth = await intelligenceQueryEngine.getDeliveryHealth(workspaceId);
    const anomalies = await intelligenceQueryEngine.getActivityAnomalies(workspaceId);

    if (hasFunction(profile, 'Engineering') || role === 'developer') {
      await populateDeveloperIntelligence(userId, workspaceId, baseIntelligence, m);
    } 
    if (hasFunction(profile, 'Projects') || role === 'pm') {
      await populatePMIntelligence(userId, workspaceId, baseIntelligence, m, deliveryHealth);
    } 
    if (rank >= getAuthorityRank('admin')) {
      await populateFounderIntelligence(workspaceId, baseIntelligence, m, deliveryHealth, anomalies);
    }
    if (hasFunction(profile, 'PeopleOperations') || hasFunction(profile, 'Finance') || hasCapability(profile, 'manage_employees') || hasCapability(profile, 'manage_finance')) {
      await populateAdminSupportIntelligence(workspaceId, profile, baseIntelligence, m);
    }
    if (role === 'client' || hasFunction(profile, 'Clients')) {
      await populateClientIntelligence(userId, workspaceId, baseIntelligence, m);
    }

  } catch (err) {
    console.error('[DailyIntelligence] Failed to fetch data:', err);
  }

  return baseIntelligence;
}

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
}

async function populatePMIntelligence(userId: string, workspaceId: string, i: DailyIntelligence, m: any, health: any) {
  i.greeting.subMessage = "Here's what needs your attention today.";

  if (health.status === 'risk') {
    i.primaryFocus = {
      id: 'focus-risk',
      message: health.suggestedAction,
      type: 'urgent',
      actionRoute: '/workspace'
    };
    health.reasons.forEach((r: string, idx: number) => {
      i.attentionItems.push({
        id: `pm-at-risk-${idx}`,
        title: 'Project Delivery Risk',
        subtitle: r,
        priority: 'High',
        actionLabel: 'Diagnose',
        actionRoute: '/workspace'
      });
    });
  } else if (health.status === 'watch') {
    i.primaryFocus = {
      id: 'focus-watch',
      message: health.suggestedAction,
      type: 'focus',
      actionRoute: '/workspace'
    };
  } else {
    i.primaryFocus = {
      id: 'focus-healthy',
      message: `Projects are healthy. Review team workload balance.`,
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
}

async function populateFounderIntelligence(workspaceId: string, i: DailyIntelligence, m: any, health: any, anomalies: any[]) {
  i.greeting.subMessage = "Company pulse and operational health.";

  if (health.status === 'risk') {
    i.primaryFocus = {
      id: 'focus-critical',
      message: health.suggestedAction,
      type: 'urgent',
      actionRoute: '/workspace'
    };
  } else {
    i.primaryFocus = {
      id: 'focus-stable',
      message: health.reasons[0] || 'Operations are stable.',
      type: 'focus',
      actionRoute: '/workspace'
    };
  }

  anomalies.forEach((a: any, idx: number) => {
    i.recentChanges.push({
      id: `anomaly-${idx}`,
      description: a.insight,
      time: 'Recent'
    });
  });
  
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

async function populateAdminSupportIntelligence(workspaceId: string, profile: any, i: DailyIntelligence, m: any) {
  i.greeting.subMessage = "Logistics and operational support.";

  if (hasCapability(profile, 'manage_employees')) {
    i.primaryFocus = {
      id: 'hr-focus',
      message: 'You have new onboarding tasks to review.',
      type: 'action',
      actionRoute: '/team/directory'
    };
  } else if (hasCapability(profile, 'manage_finance')) {
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
