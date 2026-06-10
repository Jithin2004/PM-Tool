import { Task, Project, Profile } from '../../types';

export interface WeeklyDigestInputs {
  tasks: Task[];
  projects: Project[];
  profiles: Profile[];
  activityLogs: any[];
  approvals: any[];
  workspaceSettingsBlob: any;
}

export function generateWeeklyDigestMarkdown(inputs: WeeklyDigestInputs): string {
  const { tasks, projects, profiles, activityLogs, approvals, workspaceSettingsBlob } = inputs;
  
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);

  const getProfileName = (id: string) => {
    const p = profiles.find(pr => pr.id === id);
    return p ? (p.full_name || p.email) : 'Unknown';
  };

  const getProjectName = (id: string) => {
    const p = projects.find(pr => pr.id === id);
    return p ? p.name : 'Unknown Project';
  };

  // 1. Completed this week
  const completedTasks = tasks.filter(t => 
    t.status === 'done' && 
    t.updated_at && 
    new Date(t.updated_at) >= sevenDaysAgo
  );

  // 2. Delayed work
  const delayedTasks = tasks.filter(t => 
    t.status !== 'done' && 
    t.risk === 'high' &&
    projects.some(p => p.id === t.project_id && p.status !== 'archived' && p.status !== 'deployed')
  );

  // 3. New blockers
  const newBlockers = activityLogs.filter(log => 
    log.action === 'task_blocked' && 
    new Date(log.created_at) >= sevenDaysAgo
  );

  // 4. Resolved blockers
  const resolvedBlockersLogs = activityLogs.filter(log => 
    log.action === 'task_unblocked' && 
    new Date(log.created_at) >= sevenDaysAgo
  );
  
  // Try to find resolved blockers from workspaceSettingsBlob
  const currentBlockers = workspaceSettingsBlob?.execution_blockers || [];
  const resolvedBlockers = currentBlockers.filter((b: any) => 
    b.resolved && 
    b.resolved_at && 
    new Date(b.resolved_at) >= sevenDaysAgo
  );

  // 5. Important decisions (Approvals)
  const importantDecisions = approvals.filter(a => 
    a.status === 'approved' && 
    a.approved_at && 
    new Date(a.approved_at) >= sevenDaysAgo
  );

  // 6. Next week focus
  const nextWeekEnd = new Date();
  nextWeekEnd.setDate(now.getDate() + 7);
  
  const focusTasks = tasks.filter(t => 
    t.status !== 'done' && 
    (t.priority === 'urgent' || t.priority === 'high' || (t.deadline && new Date(t.deadline) <= nextWeekEnd))
  );

  // Formatting Markdown
  let md = `# Weekly Execution Digest\n`;
  md += `*Generated on ${now.toLocaleDateString()}*\n\n`;

  md += `## 🚀 Completed This Week\n`;
  if (completedTasks.length === 0) {
    md += `*No tasks were completed this week.*\n\n`;
  } else {
    completedTasks.forEach(t => {
      md += `- **[${getProjectName(t.project_id)}]** ${t.name} (by ${getProfileName(t.assignee_id)})\n`;
    });
    md += `\n`;
  }

  md += `## ⚠️ Delayed Work\n`;
  if (delayedTasks.length === 0) {
    md += `*No work is currently marked as delayed or high risk.*\n\n`;
  } else {
    delayedTasks.forEach(t => {
      md += `- **[${getProjectName(t.project_id)}]** ${t.name} (Assigned to: ${getProfileName(t.assignee_id)})\n`;
    });
    md += `\n`;
  }

  md += `## 🛡️ New Blockers\n`;
  if (newBlockers.length === 0) {
    md += `*No new blockers reported this week.*\n\n`;
  } else {
    newBlockers.forEach(log => {
      const t = tasks.find(tsk => tsk.id === log.metadata?.task_id);
      md += `- ${t ? t.name : 'Unknown Task'} blocked by ${getProfileName(log.user_id)}\n`;
    });
    md += `\n`;
  }

  md += `## ✅ Resolved Blockers\n`;
  if (resolvedBlockers.length === 0 && resolvedBlockersLogs.length === 0) {
    md += `*No blockers were resolved this week.*\n\n`;
  } else {
    resolvedBlockers.forEach((b: any) => {
      const t = tasks.find(tsk => tsk.id === b.task_id);
      md += `- Resolved: ${t ? t.name : 'Unknown Task'} (was blocked by ${b.reason})\n`;
    });
    // In case there are logs but not in execution_blockers state
    if (resolvedBlockers.length === 0 && resolvedBlockersLogs.length > 0) {
       resolvedBlockersLogs.forEach((log: any) => {
         const t = tasks.find(tsk => tsk.id === log.metadata?.task_id);
         md += `- Resolved: ${t ? t.name : 'Unknown Task'}\n`;
       });
    }
    md += `\n`;
  }

  md += `## ⚖️ Important Decisions & Approvals\n`;
  if (importantDecisions.length === 0) {
    md += `*No formal approvals were completed this week.*\n\n`;
  } else {
    importantDecisions.forEach(a => {
      md += `- **Approved:** ${a.entity_type.toUpperCase()} - ${a.reason} (by ${getProfileName(a.approved_by)})\n`;
    });
    md += `\n`;
  }

  md += `## 🎯 Next Week Focus\n`;
  if (focusTasks.length === 0) {
    md += `*No urgent tasks or imminent deadlines for next week.*\n\n`;
  } else {
    focusTasks.forEach(t => {
      md += `- **[${getProjectName(t.project_id)}]** ${t.name} (Due: ${t.deadline ? new Date(t.deadline).toLocaleDateString() : 'ASAP'})\n`;
    });
    md += `\n`;
  }

  return md;
}
