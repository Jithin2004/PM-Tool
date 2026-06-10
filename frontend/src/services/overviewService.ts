import { supabase } from '../lib/supabase';
import { UserRole } from '../types';

export interface DailyOverview {
  role: string;
  greeting: { name: string; message: string; subMessage: string };
  metrics: { id: string; label: string; value: string | number; status?: 'good' | 'warning' | 'critical' }[];
  todayFocus: { id: string; title: string; subtitle?: string; priority: string; status: string; type?: string }[];
  blockers: { id: string; title: string; reason: string; waitTime: string }[];
  changesSinceLastLogin: { id: string; description: string; time: string; type: string }[];
  recommendations: { id: string; message: string; type: string }[];
}

export async function getDailyOverview(userId: string, workspaceId: string, role: UserRole, userName: string): Promise<DailyOverview> {
  // Base default structure
  const overview: DailyOverview = {
    role,
    greeting: { name: userName, message: 'Welcome back', subMessage: 'Here is your unified daily overview.' },
    metrics: [],
    todayFocus: [],
    blockers: [],
    changesSinceLastLogin: [],
    recommendations: []
  };

  try {
    const firstName = userName.split(' ')[0] || 'there';

    if (role === 'developer' || role === 'viewer') {
      overview.greeting.message = `Good morning, ${firstName} 👋`;
      overview.greeting.subMessage = "Here's what you need to build today.";
      await populateDeveloperAdapter(userId, workspaceId, overview);
    } 
    else if (role === 'pm') {
      overview.greeting.message = `Good morning, ${firstName} 👋`;
      overview.greeting.subMessage = "Here's where delivery needs your attention today.";
      await populatePMAdapter(userId, workspaceId, overview);
    } 
    else if (role === 'super_admin' || role === 'admin') {
      overview.greeting.message = `Good morning, ${firstName} 👋`;
      overview.greeting.subMessage = "Here is the company health and operational snapshot.";
      await populateAdminAdapter(workspaceId, overview);
    } 
    else if (role === 'hr') {
      overview.greeting.message = `Good morning, ${firstName} 👋`;
      overview.greeting.subMessage = "Here is your workforce and attendance overview.";
      await populateHRAdapter(workspaceId, overview);
    } 
    else if (role === 'finance') {
      overview.greeting.message = `Good morning, ${firstName} 👋`;
      overview.greeting.subMessage = "Here are today's financial operations.";
      await populateFinanceAdapter(workspaceId, overview);
    } 
    else if (role === 'client') {
      overview.greeting.message = `Welcome, ${firstName} 👋`;
      overview.greeting.subMessage = "Here is the progress on your projects.";
      await populateClientAdapter(userId, workspaceId, overview);
    }

  } catch (error) {
    console.error('Failed to resolve daily overview:', error);
  }

  return overview;
}

// ==========================================
// ADAPTERS
// ==========================================

async function populateDeveloperAdapter(userId: string, workspaceId: string, overview: DailyOverview) {
  // Tasks assigned to user
  const { data: tasks } = await supabase.from('tasks')
    .select('id, title, priority, status, created_at, blockers')
    .eq('workspace_id', workspaceId)
    .eq('assignee_id', userId)
    .neq('status', 'done');

  // Blockers (wait states or blocked tasks)
  const blockedTasks = (tasks || []).filter(t => t.status === 'blocked' || t.blockers);
  
  overview.greeting.subMessage = `You have ${tasks?.length || 0} active tasks and ${blockedTasks.length} blockers.`;
  
  // Metrics
  overview.metrics = [
    { id: 'm1', label: 'Assigned Tasks', value: tasks?.length || 0, status: 'good' },
    { id: 'm2', label: 'Blocked', value: blockedTasks.length, status: blockedTasks.length > 0 ? 'critical' : 'good' }
  ];

  // Today's Focus
  (tasks || []).slice(0, 5).forEach(t => {
    overview.todayFocus.push({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      type: 'Task'
    });
  });

  // Blockers
  blockedTasks.forEach(t => {
    overview.blockers.push({
      id: t.id,
      title: t.title,
      reason: t.blockers || 'Waiting on dependencies',
      waitTime: 'Action Needed'
    });
  });

  // Recommendations
  if (blockedTasks.length > 0) {
    overview.recommendations.push({ id: 'r1', message: 'Resolve your blocked tasks to unblock the sprint.', type: 'action' });
  } else if ((tasks?.length || 0) > 0) {
    overview.recommendations.push({ id: 'r1', message: `Focus on your high priority task: ${(tasks || [])[0].title}`, type: 'focus' });
  }
}

async function populatePMAdapter(userId: string, workspaceId: string, overview: DailyOverview) {
  const { data: projects } = await supabase.from('projects')
    .select('id, name, status, risk')
    .eq('workspace_id', workspaceId)
    .eq('owner_id', userId)
    .neq('status', 'archived');
    
  const activeCount = projects?.length || 0;
  const atRiskCount = projects?.filter(p => p.risk === 'high' || p.status === 'delayed').length || 0;

  overview.greeting.subMessage = `You are managing ${activeCount} active projects. ${atRiskCount} need attention.`;

  overview.metrics = [
    { id: 'm1', label: 'Active Projects', value: activeCount, status: 'good' },
    { id: 'm2', label: 'At Risk', value: atRiskCount, status: atRiskCount > 0 ? 'warning' : 'good' }
  ];

  (projects || []).slice(0, 5).forEach(p => {
    overview.todayFocus.push({
      id: p.id,
      title: p.name,
      subtitle: `Status: ${p.status}`,
      priority: p.risk === 'high' ? 'High' : 'Normal',
      status: p.status,
      type: 'Project'
    });
  });

  if (atRiskCount > 0) {
    overview.recommendations.push({ id: 'r1', message: 'Follow up on your at-risk projects immediately.', type: 'urgent' });
  }
}

async function populateAdminAdapter(workspaceId: string, overview: DailyOverview) {
  const { data: projects } = await supabase.from('projects').select('id, status, risk').eq('workspace_id', workspaceId).neq('status', 'archived');
  const activeCount = projects?.length || 0;
  const criticalCount = projects?.filter(p => p.risk === 'high').length || 0;

  overview.metrics = [
    { id: 'm1', label: 'Total Active Projects', value: activeCount, status: 'good' },
    { id: 'm2', label: 'Critical Projects', value: criticalCount, status: criticalCount > 0 ? 'critical' : 'good' },
    { id: 'm3', label: 'Financial Health', value: 'Stable', status: 'good' }
  ];

  overview.recommendations.push({ id: 'r1', message: 'Review company financial reports and team capacities.', type: 'info' });
}

async function populateHRAdapter(workspaceId: string, overview: DailyOverview) {
  const { data: profiles } = await supabase.from('profiles').select('id, role').eq('workspace_id', workspaceId);
  const employeeCount = profiles?.length || 0;

  overview.metrics = [
    { id: 'm1', label: 'Total Workforce', value: employeeCount, status: 'good' },
    { id: 'm2', label: 'Pending Leaves', value: 0, status: 'good' }
  ];

  overview.recommendations.push({ id: 'r1', message: 'Review pending attendance anomalies.', type: 'action' });
}

async function populateFinanceAdapter(workspaceId: string, overview: DailyOverview) {
  overview.metrics = [
    { id: 'm1', label: 'Pending Invoices', value: '3 Actionable', status: 'warning' },
    { id: 'm2', label: 'Monthly Expenses', value: 'Requires Review', status: 'good' }
  ];

  overview.recommendations.push({ id: 'r1', message: 'Process pending payroll approvals.', type: 'urgent' });
}

async function populateClientAdapter(userId: string, workspaceId: string, overview: DailyOverview) {
  overview.metrics = [
    { id: 'm1', label: 'Active Projects', value: 1, status: 'good' },
    { id: 'm2', label: 'Pending Approvals', value: 0, status: 'good' }
  ];

  overview.recommendations.push({ id: 'r1', message: 'Check the latest milestone deliverables.', type: 'info' });
}
