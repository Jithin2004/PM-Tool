import React, { useMemo } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { generateDailyBrief } from '../../core/execution/DailyBriefEngine';
import { Icon } from '../../components/ui/Icon';
import { ContinuityPanel } from '../../components/dashboard/ContinuityPanel';
import { generatePriorityExplanation } from '../../core/intelligence/PriorityExplanationEngine';
import { PriorityExplanationBadge } from '../../components/ui/PriorityExplanationBadge';
import { generateWaitingStates } from '../../core/waiting/WaitingStateEngine';
import { generatePersonalWorkMemory } from '../../core/memory/PersonalWorkMemoryEngine';
import { generateWorkspaceHygiene } from '../../core/hygiene/WorkspaceHygieneEngine';
import { Play, ShieldAlert } from 'lucide-react';

const navigateTo = (path: string) => {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new CustomEvent('popstate'));
};

export default function PMDailyControlCenter() {
  const { workspace } = useWorkspace() as any;
  const { profile } = useAuth();
  const { raw: { tasks, projects, profiles, workspaceSettingsBlob, activityLogs, workSessions } } = useOperationalData();

  const brief = useMemo(() => {
    if (!profile || !workspace) return null;
    
    // Approvals are fetched dynamically, assume empty for now unless passed in
    const approvals = [] as any[]; 
    const blockers = Array.isArray(workspaceSettingsBlob?.execution_blockers) 
      ? (workspaceSettingsBlob.execution_blockers as any[]) 
      : [];

    return generateDailyBrief({
      userId: profile.id,
      profileName: profile.full_name || profile.email,
      role: 'pm',
      tasks: tasks || [],
      projects: projects || [],
      approvals,
      blockers,
      workSessions: [] // Future usage
    });
  }, [profile, workspace, tasks, projects, workspaceSettingsBlob]);

  const explanationContext = useMemo(() => {
    return {
      userId: profile?.id || '',
      role: 'pm' as any,
      tasks: tasks || [],
      projects: projects || [],
      blockers: Array.isArray(workspaceSettingsBlob?.execution_blockers) ? workspaceSettingsBlob.execution_blockers : [],
      approvals: []
    };
  }, [profile, tasks, projects, workspaceSettingsBlob]);

  const waitingStates = useMemo(() => {
    if (!profile || !tasks || !projects) return [];
    return generateWaitingStates({
      userId: profile.id,
      role: 'pm',
      tasks,
      projects,
      approvals: [],
      blockers: explanationContext.blockers,
      profiles: profiles || []
    });
  }, [profile, tasks, projects, explanationContext.blockers, profiles]);

  const memory = useMemo(() => {
    if (!profile || !tasks || !projects) return null;
    return generatePersonalWorkMemory({
      userId: profile.id,
      tasks,
      projects,
      activityLogs: activityLogs || [],
      workSessions: workSessions || [],
      waitingStates
    });
  }, [profile, tasks, projects, activityLogs, workSessions, waitingStates]);

  const hygieneIssues = useMemo(() => {
    if (!tasks || !projects) return [];
    return generateWorkspaceHygiene({
      tasks,
      projects,
      blockers: explanationContext.blockers,
      approvals: []
    });
  }, [tasks, projects, explanationContext.blockers]);

  if (!brief) return null;

  return (
    <div className="space-y-8 pb-16 font-geist text-[var(--pm-primary)]" style={{ color: 'var(--pm-on-surface)' }}>
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{brief.greeting}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            PM Daily Control Center
          </p>
        </div>
      </div>
      
      <ContinuityPanel />

      {memory && memory.confidence !== 'low' && (
        <div className="glass-panel p-6 rounded-xl border border-indigo-500/20 bg-surface-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
             <Play className="w-24 h-24 text-indigo-500" />
          </div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-indigo-400 font-mono-pm mb-4 flex items-center gap-2">
            Projects You Were Handling
          </h2>
          <div className="relative z-10 grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">Based on your recent activity:</h3>
              <ul className="space-y-2">
                {memory.lastWorkedOn.slice(0, 3).map(pw => (
                  <li key={pw.taskId} className="text-sm text-text-secondary flex gap-2">
                    <span className="text-indigo-400">•</span> <span className="font-medium text-text-primary">{pw.projectName || pw.taskName}</span>
                  </li>
                ))}
                {memory.recentDecisions.slice(0, 1).map(dec => (
                  <li key={dec.title} className="text-sm text-text-secondary flex gap-2">
                     <span className="text-indigo-400">•</span> Decision: <span className="font-medium text-text-primary">{dec.description}</span>
                  </li>
                ))}
              </ul>
            </div>
            {memory.suggestedResumePoint && (
              <div className="bg-surface-highest border border-indigo-500/20 p-4 rounded-lg flex flex-col justify-between">
                <div>
                  <div className="text-xs text-indigo-400 font-semibold mb-1 uppercase tracking-wide">Suggested Next Action</div>
                  <div className="font-medium text-text-primary line-clamp-2">{memory.suggestedResumePoint.taskName}</div>
                  <div className="text-xs text-text-secondary mt-1">{memory.suggestedResumePoint.reason}</div>
                </div>
                <button onClick={() => navigateTo(memory.suggestedResumePoint!.actionRoute)} className="mt-4 w-full py-2 text-xs font-semibold rounded bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors">
                  Resume Work →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {brief.primaryFocus && (
        <div className="glass-panel p-6 rounded-xl border border-primary/50 bg-primary/10">
          <h2 className="text-xl font-bold mb-4 text-primary">Your Primary Focus:</h2>
          <div className="flex items-center justify-between p-4 rounded-lg bg-surface-highest border border-primary/30">
            <div>
              <div className="font-semibold text-lg flex items-center gap-3">
                {brief.primaryFocus.title}
                <PriorityExplanationBadge 
                  explanation={generatePriorityExplanation(
                    tasks?.find((t: any) => t.id === brief.primaryFocus!.id) || { id: brief.primaryFocus!.id },
                    'task',
                    explanationContext
                  )} 
                />
              </div>
              <div className="text-sm text-primary/80 mt-1">{brief.primaryFocus.reason}</div>
            </div>
            <button onClick={() => navigateTo(brief.primaryFocus!.action_route)} className="px-4 py-2 text-sm font-semibold rounded bg-primary text-on-primary hover:bg-primary/90 transition-colors">
              Review Issue
            </button>
          </div>
        </div>
      )}

      {!brief.primaryFocus && brief.waitingOnOthers.length === 0 && brief.dueToday.length === 0 && brief.suggestedOrder.length === 0 && (
        <div className="bg-surface-3 p-6 rounded-xl border border-border">
          <h3 className="text-lg font-semibold mb-2">You're all caught up.</h3>
          <p className="text-[var(--pm-on-surface-variant)] text-sm mb-6">
            There are no urgent execution risks, overdue tasks, or unassigned work today.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Blocked Flow */}
        <div className="glass-panel p-6 rounded-xl border border-rose-500/30 bg-surface-2 shadow-[0_0_15px_rgba(239,68,68,0.05)]">
          <h2 className="text-sm font-bold uppercase tracking-widest text-rose-500 font-mono-pm mb-4 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Chaos Monitor: Stuck Operations
          </h2>
          <div className="space-y-3">
            {waitingStates.length === 0 && <div className="text-sm text-[var(--pm-on-surface-variant)] italic">No active bottlenecks.</div>}
            {waitingStates.map(ws => (
              <div key={ws.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 p-4 rounded-lg bg-surface-3 border border-rose-500/20 shadow-sm">
                <div className="space-y-1.5 flex-1">
                  <div className="font-semibold text-sm text-rose-500 flex items-center gap-2">
                    {ws.title}
                    <span className="text-[9px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400">
                      Stuck for {Math.round(ws.waitingDurationHours)}H
                    </span>
                  </div>
                  <div className="text-xs text-text-primary"><span className="text-[var(--pm-on-surface-variant)] uppercase tracking-wider text-[10px] mr-2">Why:</span> {ws.waitingReason}</div>
                  <div className="text-xs text-text-primary"><span className="text-[var(--pm-on-surface-variant)] uppercase tracking-wider text-[10px] mr-2">Who can fix it:</span> <span className="font-semibold">{ws.waitingForName || 'Unassigned'}</span></div>
                </div>
                <button onClick={() => navigateTo(ws.actionRoute)} className="text-xs font-mono uppercase tracking-widest bg-rose-500 text-white hover:bg-rose-600 px-4 py-2 min-h-[44px] rounded transition-colors whitespace-nowrap">
                  Unblock Now
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Project Risks (Due Today / Overdue) */}
        <div className="glass-panel p-6 rounded-xl border border-border bg-surface-2">
          <h2 className="text-sm font-bold uppercase tracking-widest text-error font-mono-pm mb-4">Delivery Risks</h2>
          <div className="space-y-2">
            {brief.dueToday.length === 0 && <div className="text-sm text-[var(--pm-on-surface-variant)] italic">No overdue tasks.</div>}
            {brief.dueToday.map(item => (
              <div key={item.id} className="flex justify-between items-center p-3 rounded bg-surface-3 border border-border">
                <div>
                  <div className="font-medium text-sm flex items-center gap-2">
                    {item.title}
                    <PriorityExplanationBadge 
                      explanation={generatePriorityExplanation(
                        tasks?.find((t: any) => t.id === item.id) || { id: item.id },
                        'task',
                        explanationContext
                      )} 
                    />
                  </div>
                  <div className="text-xs text-error/80">{item.reason}</div>
                </div>
                <button onClick={() => navigateTo(item.action_route)} className="text-xs bg-surface-highest px-3 py-1 rounded hover:bg-surface-lowest border border-border">View</button>
              </div>
            ))}
          </div>
        </div>

        {/* Suggested Order (Hygiene) */}
        {brief.suggestedOrder.length > 0 && (
          <div className="glass-panel p-6 rounded-xl border border-border bg-surface-2 md:col-span-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--pm-on-surface-variant)] font-mono-pm mb-4">Project Hygiene</h2>
            <div className="space-y-2">
              {brief.suggestedOrder.map(item => (
                <div key={item.id} className="flex justify-between items-center p-3 rounded bg-surface-3 border border-border">
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {item.title}
                      <PriorityExplanationBadge 
                        explanation={generatePriorityExplanation(
                          tasks?.find((t: any) => t.id === item.id) || { id: item.id },
                          'task',
                          explanationContext
                        )} 
                      />
                    </div>
                    <div className="text-xs text-[var(--pm-on-surface-variant)]">{item.reason}</div>
                  </div>
                  <button onClick={() => navigateTo(item.action_route)} className="text-xs bg-surface-highest px-3 py-1 rounded hover:bg-surface-lowest border border-border">Clean Up</button>
                </div>
              ))}
              {hygieneIssues.map(issue => (
                <div key={issue.id} className="flex justify-between items-center p-3 rounded bg-surface-3 border border-border">
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {issue.title}
                      <span className={`text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded ${
                        issue.severity === 'high' ? 'bg-signal-error/10 text-signal-error' :
                        issue.severity === 'medium' ? 'bg-signal-warning/10 text-signal-warning' :
                        'bg-surface-3 text-text-secondary'
                      }`}>
                        {issue.type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--pm-on-surface-variant)]">{issue.detectedReason}</div>
                  </div>
                  <button onClick={() => navigateTo(issue.actionRoute)} className="text-xs bg-surface-highest px-3 py-1 rounded hover:bg-surface-lowest border border-border">{issue.safeAction}</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
