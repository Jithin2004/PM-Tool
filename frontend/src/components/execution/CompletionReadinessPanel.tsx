import React, { useState, useEffect } from 'react';
import { CompletionReadinessScore, CompletionPolicyMode } from '../../services/completionReadinessEngine';

import { Task, Approval } from '../../types';
import { WaitState } from '../../core/types/collaboration';
import { ProjectSignoff } from '../../services/completionReadinessEngine';

interface CompletionReadinessPanelProps {
  readiness: CompletionReadinessScore;
  policy: CompletionPolicyMode;
  userRole: string;
  tasks?: Task[];
  waitStates?: WaitState[];
  approvals?: Approval[];
  signoffs?: ProjectSignoff[];
  onNavigateToTask?: (taskId: string) => void;
  onNavigateToWaitState?: (wsId: string) => void;
  onNavigateToApproval?: (appId: string) => void;
  onOverride?: () => void;
  onRequestSignoff?: () => void;
  onClose?: () => void;
}

export function CompletionReadinessPanel({
  readiness,
  policy,
  userRole,
  tasks = [],
  waitStates = [],
  approvals = [],
  signoffs = [],
  onNavigateToTask,
  onNavigateToWaitState,
  onNavigateToApproval,
  onOverride,
  onRequestSignoff,
  onClose
}: CompletionReadinessPanelProps) {
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [guidedMode, setGuidedMode] = useState(false);
  const [guidedStep, setGuidedStep] = useState(1);

  const openTasks = tasks.filter(t => t.status !== 'done');
  const activeWaitStates = waitStates.filter(ws => ws.status === 'active');
  const requiredPhases = ['technical', 'client', 'compliance'];
  const missingApprovals = policy === 'enterprise' ? requiredPhases.filter(phase => !approvals.some(a => a.phase === phase && a.status === 'approved')) : [];
  const missingSignoffs = policy === 'enterprise' && signoffs.length === 0;

  useEffect(() => {
    if (!guidedMode) return;
    
    // Add a delay to prevent visual jitter if a task is completed inside an animated modal
    const timer = setTimeout(() => {
      // Auto-advance if the current step is fully resolved
      if (guidedStep === 1 && openTasks.length === 0) {
        setGuidedStep(2);
      } else if (guidedStep === 2 && activeWaitStates.length === 0) {
        setGuidedStep(3);
      } else if (guidedStep === 3 && missingApprovals.length === 0 && !missingSignoffs) {
        // All resolved, wizard complete
        setGuidedMode(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [guidedMode, guidedStep, openTasks.length, activeWaitStates.length, missingApprovals.length, missingSignoffs]);

  const totalBlockers = (openTasks.length > 0 ? 1 : 0) + (activeWaitStates.length > 0 ? 1 : 0) + (missingApprovals.length > 0 ? 1 : 0) + (missingSignoffs ? 1 : 0);
  const resolvedBlockers = (openTasks.length === 0 ? 1 : 0) + (activeWaitStates.length === 0 ? 1 : 0) + (missingApprovals.length === 0 ? 1 : 0) + (!missingSignoffs ? 1 : 0);
  const progressPercent = Math.round((resolvedBlockers / 4) * 100);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getPolicyDescription = (p: CompletionPolicyMode) => {
    switch (p) {
      case 'flexible': return 'Flexible: PM may complete project at any time. Warnings are informational.';
      case 'controlled': return 'Controlled: PM is warned about open tasks and active wait states, but completion is allowed.';
      case 'strict': return 'Strict: All tasks, wait states, and dependencies must be resolved to complete.';
      case 'enterprise': return 'Enterprise: Approvals and signoffs are additionally required on top of strict execution hygiene.';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--pm-surface)] dark:bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-surface-border flex justify-between items-center bg-surface-base">
          <h2 className="text-lg font-display text-on-surface">Completion Governance</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-on-surface">✕</button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto max-h-[80vh]">
          
          {/* Top Metric Section */}
          <div className="flex gap-6 items-center">
            <div className="flex-shrink-0 relative flex items-center justify-center w-24 h-24 rounded-full border-4 border-surface-border bg-surface-base">
              <span className={`text-3xl font-display font-bold ${getScoreColor(readiness.score)}`}>
                {readiness.score}%
              </span>
            </div>
            <div>
              <h3 className="text-sm uppercase tracking-widest font-mono text-text-tertiary mb-1">Readiness Status</h3>
              <p className={`text-xl font-bold ${
                readiness.classification === 'Healthy' ? 'text-emerald-400' :
                readiness.classification === 'At Risk' ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {readiness.classification}
              </p>
              <div className="mt-2 text-xs font-mono text-text-secondary bg-surface-base px-3 py-1.5 rounded border border-surface-border inline-block">
                <span className="text-cyan-400 font-bold uppercase">{policy} Policy</span>
                <span className="mx-2 opacity-50">|</span>
                {getPolicyDescription(policy)}
              </div>
            </div>
          </div>

          {/* Blockers & Remediation */}
          {readiness.remediationList.length > 0 && !guidedMode && (
            <div className="grid grid-cols-1 gap-6">
              
              <div className="bg-surface-base border border-surface-border rounded-xl p-5">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-bold text-on-surface flex items-center gap-2">
                    Completion Progress Tracker
                  </h4>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-32 bg-surface-3 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 transition-all" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <span className="text-xs font-mono text-cyan-400 font-bold">{progressPercent}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    {/* Tasks */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {openTasks.length === 0 ? <span className="text-emerald-400">✓</span> : <span className="text-rose-400">✗</span>}
                        <h5 className="text-xs font-bold uppercase tracking-wider text-text-secondary">Open Tasks ({openTasks.length})</h5>
                      </div>
                      {openTasks.length > 0 && (
                        <ul className="space-y-1 ml-5">
                          {openTasks.map(t => (
                            <li key={t.id}>
                              <button onClick={() => onNavigateToTask?.(t.id)} className="text-sm text-cyan-400 hover:text-cyan-300 hover:underline text-left">
                                • {t.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    
                    {/* Wait States */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {activeWaitStates.length === 0 ? <span className="text-emerald-400">✓</span> : <span className="text-rose-400">✗</span>}
                        <h5 className="text-xs font-bold uppercase tracking-wider text-text-secondary">Active Wait States ({activeWaitStates.length})</h5>
                      </div>
                      {activeWaitStates.length > 0 && (
                        <ul className="space-y-1 ml-5">
                          {activeWaitStates.map(ws => (
                            <li key={ws.id}>
                              <button onClick={() => onNavigateToWaitState?.(ws.id)} className="text-sm text-cyan-400 hover:text-cyan-300 hover:underline text-left capitalize">
                                • {ws.category} (Waiting on: {ws.waiting_on})
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Approvals */}
                    {policy === 'enterprise' && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {missingApprovals.length === 0 ? <span className="text-emerald-400">✓</span> : <span className="text-rose-400">✗</span>}
                          <h5 className="text-xs font-bold uppercase tracking-wider text-text-secondary">Missing Approvals</h5>
                        </div>
                        {missingApprovals.length > 0 && (
                          <ul className="space-y-1 ml-5">
                            {missingApprovals.map(phase => (
                              <li key={phase} className="text-sm text-amber-400 capitalize">
                                • {phase} Approval
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Signoffs */}
                    {policy === 'enterprise' && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {!missingSignoffs ? <span className="text-emerald-400">✓</span> : <span className="text-rose-400">✗</span>}
                          <h5 className="text-xs font-bold uppercase tracking-wider text-text-secondary">Signoffs</h5>
                        </div>
                        {missingSignoffs && (
                          <div className="ml-5">
                            <button onClick={onRequestSignoff} className="text-sm text-cyan-400 hover:text-cyan-300 hover:underline text-left">
                              • Request Client Signoff
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {guidedMode && (
            <div className="bg-surface-elevated border border-cyan-500/30 rounded-xl p-6 shadow-lg shadow-cyan-500/10">
              <h3 className="text-lg font-display text-cyan-400 mb-4">Guided Resolution Mode</h3>
              
              {guidedStep === 1 && (
                <div className="space-y-4">
                  <h4 className="font-bold text-on-surface">Step 1: Resolve Open Tasks</h4>
                  {openTasks.length === 0 ? (
                    <p className="text-emerald-400">All tasks completed!</p>
                  ) : (
                    <ul className="space-y-2">
                      {openTasks.map(t => (
                        <li key={t.id}>
                          <button onClick={() => onNavigateToTask?.(t.id)} className="text-sm text-cyan-400 hover:underline">• {t.name}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button onClick={() => setGuidedStep(2)} className="mt-4 px-4 py-2 bg-surface-3 hover:bg-surface-4 text-on-surface rounded">Next Step →</button>
                </div>
              )}

              {guidedStep === 2 && (
                <div className="space-y-4">
                  <h4 className="font-bold text-on-surface">Step 2: Resolve Wait States</h4>
                  {activeWaitStates.length === 0 ? (
                    <p className="text-emerald-400">No active wait states!</p>
                  ) : (
                    <ul className="space-y-2">
                      {activeWaitStates.map(ws => (
                        <li key={ws.id}>
                          <button onClick={() => onNavigateToWaitState?.(ws.id)} className="text-sm text-cyan-400 hover:underline capitalize">• {ws.category}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4 flex gap-3">
                    <button onClick={() => setGuidedStep(1)} className="px-4 py-2 border border-surface-border hover:bg-surface-3 text-on-surface rounded">← Back</button>
                    <button onClick={() => setGuidedStep(3)} className="px-4 py-2 bg-surface-3 hover:bg-surface-4 text-on-surface rounded">Next Step →</button>
                  </div>
                </div>
              )}

              {guidedStep === 3 && policy === 'enterprise' && (
                <div className="space-y-4">
                  <h4 className="font-bold text-on-surface">Step 3: Request Approvals & Signoff</h4>
                  {missingSignoffs ? (
                    <button onClick={onRequestSignoff} className="px-4 py-2 bg-cyan-500 text-[var(--pm-text)] dark:text-white font-bold rounded">Request Signoff</button>
                  ) : (
                    <p className="text-emerald-400">Signoff completed!</p>
                  )}
                  <div className="mt-4 flex gap-3">
                    <button onClick={() => setGuidedStep(2)} className="px-4 py-2 border border-surface-border hover:bg-surface-3 text-on-surface rounded">← Back</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Row */}
          <div className="flex flex-wrap gap-4 pt-4 border-t border-surface-border">
            {!readiness.isBlocker && !guidedMode && (
              <button className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-[var(--pm-text)] dark:text-white font-bold rounded-md shadow-lg shadow-emerald-500/20 transition-all">
                Complete Project
              </button>
            )}

            {readiness.isBlocker && !guidedMode && (
              <button 
                onClick={() => setGuidedMode(true)}
                className="px-6 py-2 bg-surface-3 hover:bg-surface-4 text-on-surface font-bold rounded-md border border-surface-border transition-all"
              >
                Resolve All Issues (Wizard)
              </button>
            )}

            {policy === 'enterprise' && missingSignoffs && !guidedMode && (
              <button 
                onClick={onRequestSignoff}
                className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-[var(--pm-text)] dark:text-white font-bold rounded-md shadow-lg shadow-cyan-500/20 transition-all"
              >
                Request Signoff
              </button>
            )}

            {userRole === 'super_admin' && readiness.isBlocker && (
              <div className="ml-auto flex items-center gap-3">
                {showOverrideConfirm ? (
                  <>
                    <span className="text-xs text-rose-400 animate-pulse">This action will be audited.</span>
                    <button 
                      onClick={onOverride}
                      className="px-4 py-2 border border-rose-500/50 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-[var(--pm-text)] dark:text-white text-sm font-bold rounded transition-all"
                    >
                      Confirm Override
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setShowOverrideConfirm(true)}
                    className="px-4 py-2 border border-text-tertiary/30 text-text-secondary hover:text-rose-400 hover:border-rose-400 text-sm font-bold rounded transition-all"
                  >
                    Override Governance
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
