import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { hasCapability } from '../../core/auth/permissions';
import { supabase } from '../../lib/supabase';
import { 
  AlertTriangle, 
  Check, 
  ArrowRight, 
  Clock, 
  Shield, 
  Zap, 
  Activity, 
  RotateCcw, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  X,
  UserPlus,
  Sliders,
  Sparkles,
  UserCheck,
  Calendar,
  TrendingUp,
  Info
} from 'lucide-react';

interface DependencyRiskPanelProps {
  predictions: any[];
  insights: any[];
}

export function DependencyRiskPanel({ predictions, insights }: DependencyRiskPanelProps) {
  const { profile } = useAuth();
  const { 
    raw: { projects, tasks, teams, profiles, workspaceSettingsBlob }, 
    updateWorkspaceSettings, 
    taskActions, 
    setProjects,
    governanceCache
  } = useOperationalData();

  const userRole = profile?.role || 'viewer';
  const userId = profile?.id || '';

  // Capabilities
  const isSuperAdmin = hasCapability(userRole, 'platform_governance');
  const isPM = hasCapability(userRole, 'manage_projects');
  const isDeveloper = hasCapability(userRole, 'manage_tasks') && !hasCapability(userRole, 'manage_projects');
  const isStakeholder = hasCapability(userRole, 'view_stakeholders') || userRole === 'viewer';

  const blockers = useMemo(() => {
    return (workspaceSettingsBlob?.execution_blockers || []) as any[];
  }, [workspaceSettingsBlob]);

  // Retrieve central adaptive responses and explainability diagnostics
  const adaptiveResponses = governanceCache.adaptiveResponses;
  const explainability = governanceCache.explainability;

  // Expanded card state
  const [expandedResponseId, setExpandedResponseId] = useState<string | null>(null);

  // Local checklist tracking for fallbacks
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});

  // Applied actions tracking state
  const [appliedActions, setAppliedActions] = useState<Record<string, string>>({});

  // Developer filter: filter to recommendations assigned/impacting developer directly
  const [devFilterOnlyMyContext, setDevFilterOnlyMyContext] = useState<boolean>(true);

  // Filtered responses based on role and preference
  const filteredResponses = useMemo(() => {
    if (isDeveloper && devFilterOnlyMyContext) {
      return adaptiveResponses.filter(resp => {
        const task = tasks.find(t => t.id === resp.blockerId || t.id === resp.workloadRedistribution?.taskId);
        const isAssignee = task?.assignee_id === userId;
        const isAltOwner = resp.workloadRedistribution?.availableOwnerId === userId;
        return isAssignee || isAltOwner;
      });
    }
    return adaptiveResponses;
  }, [adaptiveResponses, isDeveloper, devFilterOnlyMyContext, tasks, userId]);

  // Continuity Intelligence Analytics Calculation
  const continuityMetrics = useMemo(() => {
    const totalBlockers = blockers.filter(b => !b.resolved).length;
    const mitigatedCount = Object.keys(appliedActions).filter(k => appliedActions[k] !== 'dismissed').length;
    
    // Recovery hours saved
    let hoursSaved = 0;
    adaptiveResponses.forEach(r => {
      if (appliedActions[r.id] && appliedActions[r.id] !== 'dismissed') {
        hoursSaved += r.mitigationStrategy.expectedRecoveryHours;
      }
    });

    // Continuity Preservation Index Formula
    let index = 100;
    blockers.forEach(b => {
      if (!b.resolved) {
        let penalty = b.is_critical ? 20 : 10;
        const hasMitigation = adaptiveResponses.some(r => r.blockerId === b.id && appliedActions[r.id] && appliedActions[r.id] !== 'dismissed');
        if (hasMitigation) {
          penalty = penalty * 0.4;
        }
        index -= penalty;
      }
    });
    
    return {
      continuityIndex: Math.max(0, Math.min(100, Math.round(index))),
      totalBlockers,
      mitigatedCount,
      hoursSaved,
      successRate: totalBlockers > 0 ? Math.round((mitigatedCount / totalBlockers) * 100) : 100
    };
  }, [blockers, adaptiveResponses, appliedActions]);

  const handleApplyReassignment = async (responseId: string, taskId: string, newOwnerId: string) => {
    if (!hasCapability(profile?.role, 'manage_tasks')) {
      window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: "Unauthorized: 'manage_tasks' capability required.", type: "error" } }));
      return;
    }
    try {
      if (taskActions?.updateTask) {
        await taskActions.updateTask(taskId, { assignee_id: newOwnerId });
        
        // Log an ownership transition entry inside decisions list if present
        const decisions = (workspaceSettingsBlob?.operational_decisions || []) as any[];
        const relatedDecision = decisions.find(d => d.relatedBlockerIds?.includes(taskId));
        const taskObj = tasks.find(t => t.id === taskId);
        
        const pOwner = profiles.find((p: any) => p.id === newOwnerId);
        const newOwnerName = pOwner?.full_name || pOwner?.email || 'Unknown';
        const prevOwner = taskObj?.assignee_id || 'unassigned';
        const prevProfile = profiles.find((p: any) => p.id === prevOwner);
        const previousOwnerName = prevProfile?.full_name || prevProfile?.email || 'Unassigned';

        const trans = {
          id: `trans-${Date.now()}`,
          taskId,
          previousOwnerId: prevOwner,
          previousOwnerName,
          newOwnerId,
          newOwnerName,
          reason: 'Adaptive workload balance recommendation applied.',
          timestamp: new Date().toISOString()
        };

        const updatedDecs = relatedDecision 
          ? decisions.map(d => {
              if (d.id === relatedDecision.id) {
                return {
                  ...d,
                  ownershipTransitions: [...(d.ownershipTransitions || []), trans],
                  updatedAt: new Date().toISOString()
                };
              }
              return d;
            })
          : [
              ...decisions,
              {
                id: `dec-own-${Date.now()}`,
                workspaceId: workspaceSettingsBlob?.workspace_id || 'ws-default',
                category: 'ownership_transition',
                title: 'Adaptive Workload redistribution executed',
                description: `Workload transitioned from ${previousOwnerName} to ${newOwnerName} to bypass execution roadblock.`,
                status: 'approved',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ownershipTransitions: [trans]
              }
            ];

        await updateWorkspaceSettings({ operational_decisions: updatedDecs });
      }

      setAppliedActions(prev => ({ ...prev, [responseId]: 'reassigned' }));
      window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: "Ownership redistribution executed successfully.", type: "success" } }));
    } catch (err) {
      console.error("Failed to execute reassignment:", err);
    }
  };

  const handleEscalateBlocker = async (responseId: string, blockerId: string) => {
    if (!hasCapability(profile?.role, 'manage_tasks')) {
      window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: "Unauthorized: 'manage_tasks' capability required.", type: "error" } }));
      return;
    }
    try {
      const updatedBlockers = blockers.map(b => {
        if (b.id === blockerId) {
          return {
            ...b,
            is_critical: true,
            history: [
              ...(b.history || []),
              {
                status: 'owner_assigned',
                timestamp: new Date().toISOString(),
                actor_id: userId,
                notes: 'Adaptive auto-escalation path triggered.'
              }
            ]
          };
        }
        return b;
      });

      await updateWorkspaceSettings({ execution_blockers: updatedBlockers });
      setAppliedActions(prev => ({ ...prev, [responseId]: 'escalated' }));
      window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: "Roadblock escalated to administration.", type: "warning" } }));
    } catch (err) {
      console.error("Failed to escalate blocker:", err);
    }
  };

  const handleApplyTimelineShift = async (responseId: string, projectId: string, proposedDeadline: string) => {
    if (!hasCapability(profile?.role, 'manage_projects')) {
      window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: "Unauthorized: 'manage_projects' capability required.", type: "error" } }));
      return;
    }
    try {
      const { error } = await supabase
        .from('projects')
        .update({ deadline: proposedDeadline, updated_at: new Date().toISOString() })
        .eq('id', projectId);

      if (error) throw error;

      if (setProjects) {
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, deadline: proposedDeadline } : p));
      }

      const decisions = (workspaceSettingsBlob?.operational_decisions || []) as any[];
      const shiftDecision = {
        id: `dec-shift-${Date.now()}`,
        workspaceId: workspaceSettingsBlob?.workspace_id || 'ws-default',
        category: 'release_decision',
        title: `Project timeline shift applied`,
        description: `Project deadline shifted to proposed continuity deadline: ${proposedDeadline} to mitigate upstream roadblock drift.`,
        status: 'approved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await updateWorkspaceSettings({
        operational_decisions: [...decisions, shiftDecision]
      });

      setAppliedActions(prev => ({ ...prev, [responseId]: 'shifted' }));
      window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: "Continuity timeline adaptation applied successfully.", type: "success" } }));
    } catch (err) {
      console.error("Failed to apply timeline shift:", err);
    }
  };

  const handleForceResolveBlocker = async (responseId: string, blockerId: string) => {
    if (!hasCapability(profile?.role, 'platform_governance') && !hasCapability(profile?.role, 'manage_projects')) {
      window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: "Unauthorized: Administrative capability required.", type: "error" } }));
      return;
    }
    try {
      const updatedBlockers = blockers.map(b => {
        if (b.id === blockerId) {
          return {
            ...b,
            resolved: true,
            resolved_at: new Date().toISOString(),
            history: [
              ...(b.history || []),
              {
                status: 'resolved',
                timestamp: new Date().toISOString(),
                actor_id: userId,
                notes: 'Administrative override: Force-resolved blocker.'
              }
            ]
          };
        }
        return b;
      });

      await updateWorkspaceSettings({ execution_blockers: updatedBlockers });
      setAppliedActions(prev => ({ ...prev, [responseId]: 'resolved' }));
      window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: "Administrative override: Blocker marked resolved.", type: "success" } }));
    } catch (err) {
      console.error("Failed to force resolve blocker:", err);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedResponseId(prev => (prev === id ? null : id));
  };

  const toggleCheck = (stepId: string) => {
    setCheckedSteps(prev => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  return (
    <div className="flex flex-col gap-4 font-geist text-text-primary">
      <div className="border-b border-border pb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-signal-warning" /> Adaptive Response Console
        </span>
        <span className="text-[9px] text-text-quaternary font-bold uppercase">{filteredResponses.length} Plans</span>
      </div>

      {/* Execution Continuity Intelligence Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-2 p-3.5 rounded-xl border border-border">
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] text-text-quaternary uppercase font-bold tracking-tight">Continuity Index</span>
          <span className={`text-base font-bold font-mono ${
            continuityMetrics.continuityIndex >= 85 ? 'text-signal-safe' : continuityMetrics.continuityIndex >= 60 ? 'text-signal-warning' : 'text-signal-critical'
          }`}>
            {continuityMetrics.continuityIndex}%
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] text-text-quaternary uppercase font-bold tracking-tight">Mitigations Applied</span>
          <span className="text-base font-bold font-mono text-accent-primary">
            {continuityMetrics.mitigatedCount} <span className="text-[10px] text-text-tertiary">/ {continuityMetrics.totalBlockers}</span>
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] text-text-quaternary uppercase font-bold tracking-tight">Est. Recovery Saved</span>
          <span className="text-base font-bold font-mono text-text-primary">
            {continuityMetrics.hoursSaved}h
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] text-text-quaternary uppercase font-bold tracking-tight">Preservation Rate</span>
          <span className="text-base font-bold font-mono text-accent-secondary">
            {continuityMetrics.successRate}%
          </span>
        </div>
      </div>

      {/* Developer focus toggle */}
      {isDeveloper && (
        <div className="flex items-center justify-between bg-accent-primary/5 border border-accent-primary/10 rounded-lg p-2.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-accent-primary flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> Developer Adaptive Scope
            </span>
            <span className="text-[9px] text-text-tertiary">Filter to recommendations impacting your assigned execution tasks.</span>
          </div>
          <button 
            onClick={() => setDevFilterOnlyMyContext(prev => !prev)}
            className={`px-2.5 py-1 text-[9px] font-bold rounded uppercase tracking-wider border transition-all ${
              devFilterOnlyMyContext 
                ? 'bg-accent-primary border-accent-primary text-bg' 
                : 'bg-transparent border-border text-text-tertiary hover:bg-white/5'
            }`}
          >
            {devFilterOnlyMyContext ? 'My Context' : 'All Plans'}
          </button>
        </div>
      )}

      {/* Stakeholder notification warning */}
      {isStakeholder && (
        <div className="bg-surface-3 border border-border rounded-lg p-2.5 flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-secondary shrink-0" />
          <span className="text-[10px] text-text-secondary leading-snug">
            Stakeholder Mode: Displaying read-only adaptation progress and delivery-impact metrics.
          </span>
        </div>
      )}

      {filteredResponses.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-border rounded-xl bg-surface/30 text-text-quaternary text-xs font-mono uppercase">
          No active blockers requiring adaptation.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredResponses.map(resp => {
            const isExpanded = expandedResponseId === resp.id;
            const severityColors = {
              critical: 'border-l-signal-critical bg-signal-critical-bg border-signal-critical/20 text-signal-critical',
              high: 'border-l-signal-warning bg-signal-warning-bg border-signal-warning/20 text-signal-warning',
              medium: 'border-l-accent-secondary bg-surface-2 border-border text-accent-secondary',
              low: 'border-l-border bg-surface-3 text-text-secondary'
            };
            const currentStyle = severityColors[resp.severity] || severityColors.low;
            const actionApplied = appliedActions[resp.id];

            return (
              <div 
                key={resp.id} 
                className={`border rounded-xl flex flex-col overflow-hidden transition-all bg-surface/60 ${
                  isExpanded ? 'border-accent-primary ring-1 ring-accent-primary/20' : 'border-border hover:border-border-subtle'
                }`}
              >
                <div 
                  onClick={() => toggleExpand(resp.id)}
                  className="p-4 cursor-pointer flex items-start justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded border-l-2 uppercase tracking-wider ${currentStyle}`}>
                        {resp.severity} risk
                      </span>
                      <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-tight">
                        Strategy: {resp.mitigationStrategy.category}
                      </span>
                      {actionApplied && (
                        <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase tracking-wider">
                          Applied
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-text-primary leading-tight">{resp.mitigationStrategy.title}</h4>
                    <p className="text-[10px] text-text-secondary leading-snug mt-1">{resp.mitigationStrategy.description}</p>
                  </div>
                  <button className="text-text-tertiary hover:text-text-secondary shrink-0 pt-0.5">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="p-4 bg-surface-2 border-t border-border-subtle flex flex-col gap-4 text-xs">
                    
                    {/* Explainability Diagnostics */}
                    {explainability[resp.id] && (
                      <div className="bg-surface p-3 rounded-lg border border-border-subtle flex flex-col gap-2">
                        <span className="text-[9px] font-bold text-accent-primary uppercase tracking-widest flex items-center gap-1">
                          <Info className="w-3.5 h-3.5" /> Explainability Diagnostics
                        </span>
                        <div className="space-y-1.5 text-[10px] text-text-secondary leading-normal">
                          <p>
                            <span className="font-bold text-text-primary">Delivery Risk Cause:</span> {explainability[resp.id].whyDeliveryRisk}
                          </p>
                          <p>
                            <span className="font-bold text-text-primary">Timeline Drift:</span> {explainability[resp.id].whyExecutionDrift}
                          </p>
                          <p>
                            <span className="font-bold text-text-primary">Mitigation Justification:</span> {explainability[resp.id].whyMitigationRecommended}
                          </p>
                          <p>
                            <span className="font-bold text-text-primary">Dependency Stability:</span> {explainability[resp.id].whyDependencyUnstable}
                          </p>
                          <p>
                            <span className="font-bold text-text-primary">Continuity Risk Context:</span> {explainability[resp.id].whyContinuityRiskIncreased}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Alternate execution path rerouting */}
                    {resp.reroute && (
                      <div className="bg-surface p-3 rounded-lg border border-border-subtle flex flex-col gap-2">
                        <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest block">Execution Reroute Recommendation</span>
                        <p className="text-[10px] text-text-secondary leading-normal">{resp.reroute.rationale}</p>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-accent-primary pt-1 border-t border-border-subtle">
                          <span className="truncate max-w-[120px]">{resp.reroute.taskName}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-text-quaternary" />
                          <span className="truncate max-w-[120px] text-text-secondary">{resp.reroute.alternativeTaskName}</span>
                        </div>
                      </div>
                    )}

                    {/* Workload redistribution controls */}
                    {resp.workloadRedistribution && (
                      <div className="bg-surface p-3 rounded-lg border border-border-subtle flex flex-col gap-2">
                        <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest block">Workload Handoff Plan</span>
                        <div className="flex items-center justify-between text-[10px]">
                          <div>
                            <span className="text-text-tertiary uppercase block">Overloaded:</span>
                            <span className="font-bold text-text-primary">{resp.workloadRedistribution.overloadedOwnerName}</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-text-quaternary" />
                          <div>
                            <span className="text-text-tertiary uppercase block">Available Alt:</span>
                            <span className="font-bold text-accent-primary">{resp.workloadRedistribution.availableOwnerName}</span>
                          </div>
                        </div>
                        {(isPM || isSuperAdmin) && !actionApplied && (
                          <button
                            onClick={() => handleApplyReassignment(resp.id, resp.workloadRedistribution!.taskId, resp.workloadRedistribution!.availableOwnerId)}
                            className="mt-2 w-full py-1.5 bg-accent-primary/10 border border-accent-primary/20 text-accent-primary hover:bg-accent-primary/15 rounded text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> Execute Workload Handoff
                          </button>
                        )}
                      </div>
                    )}

                    {/* Dependency substitution/mocking */}
                    {resp.dependencyMitigation && (
                      <div className="bg-surface p-3 rounded-lg border border-border-subtle flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest block">Dependency Decoupling strategy</span>
                        <div className="text-[10px] text-text-secondary bg-surface-3 p-2 rounded border border-border-subtle italic">
                          "{resp.dependencyMitigation.substitutionStrategy}"
                        </div>
                        <span className="text-[9px] text-text-quaternary font-bold block">
                          Unblocks: {resp.dependencyMitigation.blockedTaskName}
                        </span>
                      </div>
                    )}

                    {/* Escalation path authorization */}
                    {resp.escalationRecommendation && (
                      <div className="bg-surface p-3 rounded-lg border border-border-subtle flex flex-col gap-2">
                        <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest block font-bold text-rose-400">Escalation path bypass recommendation</span>
                        <p className="text-[10px] text-text-secondary">{resp.escalationRecommendation.reasonForEscalation}</p>
                        {(isPM || isSuperAdmin) && !actionApplied && (
                          <button
                            onClick={() => handleEscalateBlocker(resp.id, resp.escalationRecommendation!.blockerId)}
                            className="w-full py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/15 rounded text-[9px] font-bold uppercase tracking-wider transition-all"
                          >
                            Authorize Blocker Escalation
                          </button>
                        )}
                      </div>
                    )}

                    {/* Continuity Plan & release-window adaptation */}
                    {resp.continuityPlan && (
                      <div className="bg-surface p-3 rounded-lg border border-border-subtle flex flex-col gap-2">
                        <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest block">Release-Window Adaptation Plan</span>
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-text-tertiary">Project:</span>
                            <span className="font-bold text-text-primary">{resp.continuityPlan.projectName}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-text-tertiary">Current Target:</span>
                            <span className="font-bold text-text-secondary line-through font-mono">
                              {new Date(resp.continuityPlan.originalDeadline).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-text-tertiary">Proposed target:</span>
                            <span className="font-bold text-accent-secondary font-mono">
                              {new Date(resp.continuityPlan.proposedDeadline).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-[9px] text-text-quaternary border-t border-border-subtle pt-1 mt-1">
                          Deferred Tasks: {resp.continuityPlan.deferredTaskNames.join(', ')}
                        </div>
                        {(isPM || isSuperAdmin) && !actionApplied && (
                          <button
                            onClick={() => handleApplyTimelineShift(resp.id, resp.continuityPlan!.projectId, resp.continuityPlan!.proposedDeadline)}
                            className="mt-2 w-full py-1.5 bg-accent-secondary/10 border border-accent-secondary/20 text-accent-secondary hover:bg-accent-secondary/15 rounded text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                          >
                            <Calendar className="w-3.5 h-3.5" /> Apply Timeline Shift
                          </button>
                        )}
                      </div>
                    )}

                    {/* Fallback steps checklists */}
                    {resp.operationalFallback && (
                      <div className="bg-surface p-3 rounded-lg border border-border-subtle flex flex-col gap-2">
                        <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest block">Operational Fallback checklist</span>
                        <div className="space-y-1.5 mt-1">
                          {resp.operationalFallback.fallbackSteps.map((step, idx) => {
                            const stepId = `${resp.id}-step-${idx}`;
                            const isChecked = checkedSteps[stepId];
                            
                            return (
                              <label 
                                key={idx} 
                                className="flex items-start gap-2 cursor-pointer text-[10px] text-text-secondary hover:text-text-primary"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked || false}
                                  onChange={() => toggleCheck(stepId)}
                                  className="mt-0.5 rounded border-border text-accent-primary focus:ring-0 shrink-0 w-3 h-3"
                                />
                                <span className={isChecked ? 'line-through opacity-50' : ''}>{step}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Super Admin specific overrides */}
                    {isSuperAdmin && !actionApplied && (
                      <div className="mt-2 pt-2 border-t border-dashed border-border flex flex-col gap-1.5">
                        <span className="text-[8px] font-bold text-text-quaternary uppercase tracking-widest flex items-center gap-0.5">
                          <Sliders className="w-3 h-3 text-rose-400" /> Platform Governance Actions
                        </span>
                        <button
                          onClick={() => handleForceResolveBlocker(resp.id, resp.blockerId)}
                          className="w-full py-1 bg-signal-critical/10 border border-signal-critical/20 text-signal-critical hover:bg-signal-critical/15 rounded text-[9px] font-bold uppercase tracking-wider transition-all"
                        >
                          Administrative Block Override
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
