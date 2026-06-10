import React, { useState, useEffect, useMemo } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { generateDecisionInsights, DecisionInsight } from '../../core/decision/DecisionIntelligenceEngine';
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, ArrowRight, Activity, Terminal } from 'lucide-react';
import { generatePriorityExplanation } from '../../core/intelligence/PriorityExplanationEngine';
import { PriorityExplanationBadge } from '../../components/ui/PriorityExplanationBadge';
import { generateWaitingStates } from '../../core/waiting/WaitingStateEngine';
import { generatePersonalWorkMemory } from '../../core/memory/PersonalWorkMemoryEngine';
import { generateWorkspaceHygiene } from '../../core/hygiene/WorkspaceHygieneEngine';
import { Play } from 'lucide-react';
import { ContinuityPanel } from '../../components/dashboard/ContinuityPanel';

export default function FounderTodayCommandCenter() {
  const { workspace, projects: workspaceProjects } = useWorkspace() as any;

  const { raw: { tasks, projects, teams, profiles, invoices, contracts, leaves, workspaceSettingsBlob, activityLogs, workSessions } } = useOperationalData();
  const { profile: currentUserProfile } = useAuth();
  const navigateTo = (path: string) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('popstate'));
  };

  const [approvals, setApprovals] = useState<any[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(true);

  useEffect(() => {
    if (workspace?.id && currentUserProfile?.id) {
      fetchPendingApprovals();
    }
  }, [workspace?.id, currentUserProfile?.id]);

  const fetchPendingApprovals = async () => {
    setLoadingApprovals(true);
    try {
      const { data } = await supabase
        .from('universal_approvals')
        .select('*, requested_by_user:users!requested_by(email, full_name)')
        .eq('workspace_id', workspace.id)
        .eq('status', 'pending');
      if (data) {
        // Filter those where this user is the requested approver, or if it's a company-wide approval
        setApprovals(data);
      }
    } finally {
      setLoadingApprovals(false);
    }
  };

  const handleApprove = async (approvalId: string) => {
    try {
      await supabase.from('universal_approvals').update({ 
        status: 'approved', 
        approved_by: currentUserProfile.id,
        approved_at: new Date().toISOString()
      }).eq('id', approvalId);
      setApprovals(approvals.filter(a => a.id !== approvalId));
    } catch (e) {
      console.error(e);
    }
  };

  const insights = useMemo(() => {
    if (!currentUserProfile || !workspace) return [];
    return generateDecisionInsights({
      userId: currentUserProfile.id,
      role: currentUserProfile.role,
      projects: projects || [],
      tasks: tasks || [],
      teams: teams || [],
      profiles: profiles || [],
      workspaceSettingsBlob: workspace.settings,
      invoices: invoices || [],
      contracts: contracts || [],
      leaves: leaves || []
    });
  }, [currentUserProfile, workspace, projects, tasks, teams, profiles, invoices, contracts, leaves]);

  const activeBlockers = Array.isArray(workspace?.settings?.execution_blockers) ? workspace.settings.execution_blockers : [];

  const waitingStates = useMemo(() => {
    if (!currentUserProfile || !tasks || !projects) return [];
    return generateWaitingStates({
      userId: currentUserProfile.id,
      role: currentUserProfile.role,
      tasks,
      projects,
      approvals: approvals || [],
      blockers: activeBlockers,
      profiles: profiles || []
    });
  }, [currentUserProfile, tasks, projects, approvals, activeBlockers, profiles]);

  const memory = useMemo(() => {
    if (!currentUserProfile || !tasks || !projects) return null;
    return generatePersonalWorkMemory({
      userId: currentUserProfile.id,
      tasks,
      projects,
      activityLogs: activityLogs || [],
      workSessions: workSessions || [],
      waitingStates
    });
  }, [currentUserProfile, tasks, projects, activityLogs, workSessions, waitingStates]);

  const waitingForMeTasks = tasks?.filter((t: any) => t.assignee_id === currentUserProfile?.id && t.status !== 'done') || [];

  const hygieneIssues = useMemo(() => {
    if (!tasks || !projects) return [];
    return generateWorkspaceHygiene({
      tasks,
      projects,
      blockers: activeBlockers,
      approvals: approvals || []
    });
  }, [tasks, projects, activeBlockers, approvals]);

  const recentlyCompleted = useMemo(() => {
    const doneTasks = tasks?.filter((t: any) => t.status === 'done' && t.updated_at) || [];
    const sorted = [...doneTasks].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return sorted.slice(0, 5);
  }, [tasks]);

  const delayedProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter((p: any) => p.status !== 'done' && p.status !== 'archived' && (p.risk === 'high' || p.delay_drift_days > 0));
  }, [projects]);


  const explanationContext = useMemo(() => {
    return {
      userId: currentUserProfile?.id || '',
      role: currentUserProfile?.role || 'admin' as any,
      tasks: tasks || [],
      projects: projects || [],
      blockers: Array.isArray(workspace?.settings?.execution_blockers) ? workspace.settings.execution_blockers : [],
      approvals: approvals || []
    };
  }, [currentUserProfile, tasks, projects, workspace, approvals]);

  return (
    <div className="space-y-6 pb-16 font-geist max-w-6xl mx-auto px-4 sm:px-6 mt-6">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-500" />
            Founder Command Center
          </h1>
          <p className="text-sm mt-1 text-text-secondary">
            Your execution pulse for {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.
          </p>
        </div>
      </div>
      
      <ContinuityPanel />

      {memory && memory.confidence !== 'low' && (
        <div className="glass-panel p-6 rounded-xl border border-indigo-500/20 bg-surface-2 relative overflow-hidden mb-6">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
             <Play className="w-24 h-24 text-indigo-500" />
          </div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-indigo-400 font-mono-pm mb-4 flex items-center gap-2">
            Decisions You Were Tracking
          </h2>
          <div className="relative z-10 grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">Recent Founder Activity:</h3>
              <ul className="space-y-2">
                {memory.recentDecisions.slice(0, 3).map(dec => (
                  <li key={dec.title + Math.random()} className="text-sm text-text-secondary flex gap-2">
                     <span className="text-indigo-400">•</span> Decision: <span className="font-medium text-text-primary">{dec.description}</span>
                  </li>
                ))}
                {memory.waitingItems.slice(0, 1).map(wi => (
                  <li key={wi.title} className="text-sm text-text-secondary flex gap-2">
                     <span className="text-indigo-400">•</span> Bottleneck: <span className="font-medium text-text-primary">{wi.title}</span>
                  </li>
                ))}
                {memory.recentDecisions.length === 0 && memory.waitingItems.length === 0 && (
                   <li className="text-sm text-text-secondary italic">No recent tracking context found.</li>
                )}
              </ul>
            </div>
            {memory.suggestedResumePoint && (
              <div className="bg-surface-highest border border-indigo-500/20 p-4 rounded-lg flex flex-col justify-between">
                <div>
                  <div className="text-xs text-indigo-400 font-semibold mb-1 uppercase tracking-wide">Suggested Focus</div>
                  <div className="font-medium text-text-primary line-clamp-2">{memory.suggestedResumePoint.taskName}</div>
                  <div className="text-xs text-text-secondary mt-1">{memory.suggestedResumePoint.reason}</div>
                </div>
                <button onClick={() => navigateTo(memory.suggestedResumePoint!.actionRoute)} className="mt-4 w-full py-2 text-xs font-semibold rounded bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors">
                  Investigate →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Actions & Decisions */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Waiting For Me (Approvals & Assigned Tasks) */}
          <div className="bg-surface-elevated rounded-lg border border-border shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border bg-surface flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-text-primary">Waiting For Me</h2>
            </div>
            <div className="p-0">
              {approvals.length === 0 && (
                <div className="p-6 text-center text-xs text-text-tertiary">No pending approvals.</div>
              )}
              <ul className="divide-y divide-border-subtle">
                {approvals.map(app => (
                  <li key={app.id} className="p-4 hover:bg-surface-hover transition-colors flex justify-between items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-mono tracking-widest text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">Approval Required</span>
                        <PriorityExplanationBadge 
                          explanation={generatePriorityExplanation(
                            app,
                            'approval',
                            explanationContext
                          )} 
                        />
                      </div>
                      <p className="text-sm font-medium text-text-primary mt-1">{app.entity_type.toUpperCase()}: {app.reason}</p>
                      <p className="text-xs text-text-secondary mt-0.5">Requested by {app.requested_by_user?.full_name || app.requested_by_user?.email || 'Unknown'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(app.id)} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-xs font-semibold rounded transition-colors">Approve</button>
                    </div>
                  </li>
                ))}

              </ul>
            </div>
          </div>

          {/* Strategic Decisions */}
          <div className="bg-surface-elevated rounded-lg border border-border shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border bg-surface flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-semibold text-text-primary">Needs My Decision (AI Intelligence)</h2>
            </div>
            <div className="p-0">
              {insights.length === 0 ? (
                <div className="p-6 text-center text-xs text-text-tertiary">No critical strategic decisions required.</div>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {insights.slice(0, 5).map(insight => (
                    <li key={insight.id} className="p-4 hover:bg-surface-hover transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded ${
                            insight.severity === 'critical' ? 'bg-signal-error/10 text-signal-error' :
                            insight.severity === 'warning' ? 'bg-signal-warning/10 text-signal-warning' :
                            'bg-signal-info/10 text-signal-info'
                          }`}>
                            {insight.category.replace('_', ' ')}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-text-tertiary">Confidence: {insight.confidence}%</span>
                      </div>
                      <p className="text-sm font-semibold text-text-primary mb-1">{insight.title}</p>
                      <p className="text-xs text-text-secondary mb-3 leading-relaxed">{insight.recommendation}</p>
                      
                      {insight.actionRoute && insight.actionLabel && (
                        <button 
                          onClick={() => navigateTo(insight.actionRoute!)}
                          className="px-3 py-1.5 bg-accent-primary text-[var(--pm-text)] text-[var(--text-primary)] text-xs font-semibold rounded hover:bg-accent-primary/90 transition-colors inline-flex items-center gap-1.5 shadow-sm"
                        >
                          {insight.actionLabel} <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Waiting For Movement */}
          <div className="bg-surface-elevated rounded-lg border border-border shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border bg-surface flex items-center gap-2">
              <Clock className="w-4 h-4 text-text-tertiary" />
              <h2 className="text-sm font-semibold text-text-primary">Waiting For Movement</h2>
            </div>
            <div className="p-0">
              {waitingStates.length === 0 ? (
                <div className="p-6 text-center text-xs text-text-tertiary">No identified bottlenecks.</div>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {waitingStates.slice(0, 5).map(ws => (
                    <li key={ws.id} className="p-4 hover:bg-surface-hover transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded ${
                            ws.severity === 'critical' ? 'bg-signal-error/10 text-signal-error' :
                            ws.severity === 'attention' ? 'bg-signal-warning/10 text-signal-warning' :
                            'bg-surface-3 text-text-secondary'
                          }`}>
                            {ws.sourceType.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-text-tertiary">
                          Waiting {Math.round(ws.waitingDurationHours)}h
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-text-primary mb-1">{ws.title}</p>
                      <p className="text-xs text-text-secondary mb-3 leading-relaxed">
                        Reason: {ws.waitingReason} <br/>
                        <span className="font-medium mt-1 block">Owner: {ws.waitingForName || 'Unassigned'}</span>
                      </p>
                      
                      <button 
                        onClick={() => navigateTo(ws.actionRoute)}
                        className="px-3 py-1.5 bg-surface-3 text-[var(--pm-text)] text-[var(--text-primary)] text-xs font-semibold rounded hover:bg-surface-hover border border-border transition-colors inline-flex items-center gap-1.5 shadow-sm"
                      >
                        {ws.recommendedAction} <ArrowRight className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Pulse & Risks */}
        <div className="space-y-6">
          
          {/* Projects Needing Attention */}
          <div className="bg-surface-elevated rounded-lg border border-border shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border bg-surface flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-signal-warning" />
              <h2 className="text-sm font-semibold text-text-primary">Projects Needing Attention</h2>
            </div>
            <div className="p-4">
              {delayedProjects.length === 0 ? (
                <div className="text-xs text-text-tertiary text-center py-2">All projects are healthy.</div>
              ) : (
                <ul className="space-y-3">
                  {delayedProjects.map(p => (
                    <li key={p.id} className="flex justify-between items-center p-2 rounded bg-signal-warning/5 border border-signal-warning/20">
                      <span className="text-xs font-medium text-text-primary truncate max-w-[150px]">{p.name}</span>
                      <button onClick={() => navigateTo('/workspace')} className="text-[10px] font-semibold text-signal-warning hover:underline">Review</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Team Blockers */}
          <div className="bg-surface-elevated rounded-lg border border-border shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border bg-surface flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-signal-error" />
              <h2 className="text-sm font-semibold text-text-primary">Active Team Blockers</h2>
            </div>
            <div className="p-4">
              {activeBlockers.length === 0 ? (
                <div className="text-xs text-text-tertiary text-center py-2">No active blockers.</div>
              ) : (
                <ul className="space-y-3">
                  {activeBlockers.map((b: any) => {
                    const t = tasks?.find((task: any) => task.id === b.task_id);
                    return (
                      <li key={b.id} className="p-2 rounded bg-signal-error/5 border border-signal-error/20">
                        <div className="text-xs font-medium text-text-primary mb-1">Blocked: {t?.name || 'Unknown Task'}</div>
                        <div className="text-[10px] text-text-secondary leading-snug line-clamp-2">{b.reason}</div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>



          {/* Workspace Cleanup */}
          <div className="bg-surface-elevated rounded-lg border border-border shadow-sm overflow-hidden mt-6">
            <div className="p-4 border-b border-border bg-surface flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-text-tertiary" />
              <h2 className="text-sm font-semibold text-text-primary">Workspace Cleanup</h2>
            </div>
            <div className="p-0">
              {hygieneIssues.length === 0 ? (
                <div className="p-4 text-xs text-text-tertiary text-center">No hygiene issues detected.</div>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {hygieneIssues.slice(0, 4).map(issue => (
                    <li key={issue.id} className="p-3 hover:bg-surface-hover transition-colors">
                      <div className="flex justify-between">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded ${
                            issue.severity === 'high' ? 'bg-signal-error/10 text-signal-error' :
                            issue.severity === 'medium' ? 'bg-signal-warning/10 text-signal-warning' :
                            'bg-surface-3 text-text-secondary'
                          }`}>
                            {issue.type.replace('_', ' ')}
                          </span>
                        </div>
                        <button onClick={() => navigateTo(issue.actionRoute)} className="text-[10px] font-semibold text-indigo-400 hover:underline">{issue.safeAction}</button>
                      </div>
                      <p className="text-xs font-medium text-text-primary line-clamp-1">{issue.title}</p>
                      <p className="text-[10px] text-text-tertiary mt-0.5">{issue.detectedReason}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
