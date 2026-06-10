import React, { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { generateDailyBrief } from '../../core/execution/DailyBriefEngine';
import { useLiveTimer } from '../../hooks/useLiveTimer';
import { Icon } from '../../components/ui/Icon';
import { ContinuityPanel } from '../../components/dashboard/ContinuityPanel';
import { generatePriorityExplanation } from '../../core/intelligence/PriorityExplanationEngine';
import { PriorityExplanationBadge } from '../../components/ui/PriorityExplanationBadge';
import { generateWaitingStates } from '../../core/waiting/WaitingStateEngine';
import { generatePersonalWorkMemory } from '../../core/memory/PersonalWorkMemoryEngine';
import { Play, Bell, Clock } from 'lucide-react';
import { FollowUpEngine } from '../../core/system/FollowUpEngine';

const navigateTo = (path: string) => {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new CustomEvent('popstate'));
};

export default function DeveloperMyWorkToday() {
  const { profile } = useAuth();
  const { raw: { tasks, projects, workSessions, workspaceSettingsBlob, teams, profiles, activityLogs } } = useOperationalData();

  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loadingFollowUps, setLoadingFollowUps] = useState(true);

  const loadFollowUps = async () => {
    if (!profile?.id) return;
    setLoadingFollowUps(true);
    const data = await FollowUpEngine.fetchFollowUps(profile.id);
    setFollowUps(data);
    setLoadingFollowUps(false);
  };

  useEffect(() => {
    loadFollowUps();
  }, [profile?.id]);

  const handleCompleteFollowUp = async (id: string) => {
    const success = await FollowUpEngine.completeFollowUp(id);
    if (success) {
      setFollowUps(prev => prev.map(f => f.id === id ? { ...f, completed: true } : f));
    }
  };

  const myTeam = useMemo(() => {
    if (!profile || !teams) return null;
    return teams.find((t: any) => {
      const devIds = t.data?.developer_ids || [];
      return Array.isArray(devIds) && devIds.includes(profile.id);
    });
  }, [teams, profile]);

  const myPm = useMemo(() => {
    if (!myTeam || !profiles) return null;
    return profiles.find((p: any) => p.id === (myTeam.data as any)?.pm_id);
  }, [myTeam, profiles]);

  const myProjects = useMemo(() => {
    if (!myTeam || !projects) return [];
    return projects.filter((p: any) => p.team_id === myTeam.id);
  }, [myTeam, projects]);

  const brief = useMemo(() => {
    if (!profile) return null;
    const blockers = Array.isArray(workspaceSettingsBlob?.execution_blockers) 
      ? (workspaceSettingsBlob.execution_blockers as any[]) 
      : [];

    return generateDailyBrief({
      userId: profile.id,
      profileName: profile.full_name || profile.email,
      role: 'developer',
      tasks: tasks || [],
      projects: projects || [],
      approvals: [],
      blockers,
      workSessions: workSessions || []
    });
  }, [profile, tasks, projects, workspaceSettingsBlob, workSessions]);

  const explanationContext = useMemo(() => {
    return {
      userId: profile?.id || '',
      role: profile?.role || 'developer' as any,
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
      role: profile.role || 'developer',
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

  const { formattedTime } = useLiveTimer(brief?.continueWork ? (workSessions?.find((s: any) => s.user_id === profile?.id && !s.end_time)?.start_time || null) : null);

  if (!brief) return null;

  return (
    <div className="space-y-8 pb-16 font-geist text-[var(--pm-primary)]" style={{ color: 'var(--pm-on-surface)' }}>
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{brief.greeting}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Your Daily Brief
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
            What Changed (Continuity Engine)
          </h2>
          <div className="relative z-10 grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">Based on your last session:</h3>
              <ul className="space-y-2">
                {memory.lastWorkedOn.slice(0, 2).map(pw => (
                  <li key={pw.taskId} className="text-sm text-text-secondary flex gap-2">
                    <span className="text-indigo-400">•</span> You worked {pw.durationHours}h on <span className="font-medium text-text-primary">{pw.taskName}</span>
                  </li>
                ))}
                {memory.pausedWork.slice(0, 1).map(pw => (
                  <li key={pw.taskId} className="text-sm text-text-secondary flex gap-2">
                     <span className="text-indigo-400">•</span> Paused: <span className="font-medium text-text-primary">{pw.taskName}</span>
                  </li>
                ))}
                {memory.unfinishedIntentions.slice(0, 1).map(intent => (
                  <li key={intent.title} className="text-sm text-text-secondary flex gap-2">
                     <span className="text-indigo-400">•</span> You planned to: <span className="font-medium text-text-primary">{intent.title}</span>
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

      {brief.continueWork && (
        <div className="glass-panel p-6 rounded-xl border border-indigo-500/30 bg-indigo-500/5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-indigo-400 font-mono-pm mb-4">Currently Running</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-lg">{brief.continueWork.title}</div>
              <div className="text-xs text-[var(--pm-on-surface-variant)] mt-1">Expected: {brief.continueWork.metadata?.estimated || 0}h</div>
            </div>
            <div className="text-3xl font-mono-pm font-bold text-indigo-300">
              {formattedTime}
            </div>
          </div>
          <button onClick={() => navigateTo(brief.continueWork!.action_route)} className="mt-4 px-4 py-2 text-xs font-semibold rounded bg-indigo-500 text-white hover:bg-indigo-600 transition-colors">
            Return to Task →
          </button>
        </div>
      )}

      {brief.primaryFocus && (
        <div className="glass-panel p-6 rounded-xl border border-primary/50 bg-primary/10">
          <h2 className="text-xl font-bold mb-4 text-primary">What To Do (Primary Focus):</h2>
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
              Start Work
            </button>
          </div>
        </div>
      )}

      {!brief.primaryFocus && !brief.continueWork && brief.suggestedOrder.length === 0 && brief.waitingOnOthers.length === 0 && (
        <div className="bg-surface-3 p-6 rounded-xl border border-border">
          <h3 className="text-lg font-semibold mb-2">Welcome to your workspace.</h3>
          <p className="text-[var(--pm-on-surface-variant)] text-sm mb-6">
            You currently have no tasks assigned for today.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-surface-4 border border-border">
              <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--pm-on-surface-variant)] block mb-1">Your Manager</span>
              {myPm ? (
                <div className="font-semibold">{myPm.full_name || myPm.email}</div>
              ) : (
                <div className="text-sm italic text-[var(--pm-on-surface-variant)]">No manager assigned yet.</div>
              )}
            </div>
            <div className="p-4 rounded-lg bg-surface-4 border border-border">
              <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--pm-on-surface-variant)] block mb-1">Your Active Projects</span>
              {myProjects.length > 0 ? (
                <ul className="text-sm font-semibold space-y-1">
                  {myProjects.map((p: any) => <li key={p.id}>{p.name}</li>)}
                </ul>
              ) : (
                <div className="text-sm italic text-[var(--pm-on-surface-variant)]">No active projects mapped to your team.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {brief.blockingOthers.length > 0 && (
        <div className="glass-panel p-6 rounded-xl border border-error/50 bg-error/5 mb-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-error font-mono-pm mb-4 flex items-center gap-2">
            <Icon name="warning" className="w-4 h-4" /> What is Blocked (You are blocking others)
          </h2>
          <div className="space-y-2">
            {brief.blockingOthers.map(item => (
              <div key={item.id} className="flex justify-between items-center p-3 rounded bg-surface-highest border border-error/20">
                <div>
                  <div className="font-medium text-sm text-error">{item.title}</div>
                  <div className="text-xs text-error/70">{item.reason}</div>
                </div>
                <button onClick={() => navigateTo(item.action_route)} className="text-xs bg-error/10 text-error px-3 py-1 rounded hover:bg-error/20">View</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Follow Ups Section */}
      <div className="glass-panel p-6 rounded-xl border border-indigo-500/20 bg-surface-2 mb-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-indigo-400 font-mono-pm mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4 animate-pulse" /> My Follow Ups
        </h2>
        {loadingFollowUps ? (
          <div className="text-xs text-text-quaternary animate-pulse">Loading reminders...</div>
        ) : followUps.length === 0 ? (
          <div className="text-xs text-[var(--pm-on-surface-variant)] italic">No follow-ups registered. Ask the workflow engine by writing 'remind me tomorrow' or 'waiting until Friday' in task comments.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {followUps.map(item => (
              <div key={item.id} className={`flex items-start justify-between p-3.5 rounded-lg border transition-all ${item.completed ? 'bg-surface-lowest border-border/10 opacity-50' : 'bg-surface-3 border-border hover:border-indigo-500/30'}`}>
                <div className="flex items-start gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    disabled={item.completed}
                    onChange={() => handleCompleteFollowUp(item.id)}
                    className="mt-0.5 rounded border-border-subtle bg-surface-lowest accent-indigo-500 text-white w-4 h-4 cursor-pointer focus:ring-0"
                  />
                  <div>
                    <div className={`text-xs font-semibold ${item.completed ? 'line-through text-text-tertiary' : 'text-text-primary'}`}>{item.reason}</div>
                    <div className="text-[10px] text-text-quaternary font-mono mt-1 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-indigo-400/50" />
                      Remind at: {new Date(item.remind_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-xl border border-border bg-surface-2">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--pm-on-surface-variant)] font-mono-pm mb-4">Suggested Order</h2>
          <div className="space-y-2">
            {brief.suggestedOrder.length === 0 && <div className="text-sm text-[var(--pm-on-surface-variant)] italic">Nothing else up next.</div>}
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
                </div>
                <button onClick={() => navigateTo(item.action_route)} className="text-xs bg-surface-highest px-3 py-1 rounded hover:bg-surface-lowest">View</button>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border bg-surface-2">
          <h2 className="text-sm font-bold uppercase tracking-widest text-amber-500 font-mono-pm mb-4">Who Needs Me (Waiting On You)</h2>
          <div className="space-y-2">
            {waitingStates.length === 0 && <div className="text-sm text-[var(--pm-on-surface-variant)] italic">You are unblocked.</div>}
            {waitingStates.map(ws => (
              <div key={ws.id} className="flex justify-between items-center p-3 rounded bg-surface-3 border border-amber-500/20">
                <div>
                  <div className="font-medium text-sm text-amber-500 flex items-center gap-2">
                    {ws.title}
                    <span className={`text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded ${
                      ws.severity === 'critical' ? 'bg-signal-error/10 text-signal-error' :
                      ws.severity === 'attention' ? 'bg-signal-warning/10 text-signal-warning' :
                      'bg-surface-3 text-text-secondary'
                    }`}>
                      {Math.round(ws.waitingDurationHours)}H
                    </span>
                  </div>
                  <div className="text-xs text-amber-500/70">{ws.waitingReason}</div>
                </div>
                <button onClick={() => navigateTo(ws.actionRoute)} className="text-xs bg-amber-500/10 text-amber-500 px-3 py-1 rounded hover:bg-amber-500/20 whitespace-nowrap mt-1">Resolve</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
