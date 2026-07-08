import React, { useState } from 'react';
import { Icon } from '../ui/Icon';
import { DecisionInsight } from '../../core/decision/DecisionIntelligenceEngine';
import { simulateActionImpact, SimulationResult, SimulatorState } from '../../core/decision/ExecutionImpactSimulator';
import { executeDecisionAction } from '../../services/decisionExecutionService';
import { replace } from '../../lib/navigation';


interface Props {
  insight: DecisionInsight;
  simulatorState: SimulatorState;
  workspaceId: string;
  userId: string;
  onDismiss: (id: string) => void;
  onRefresh: () => void;
  notify: any;
}

export function DecisionInsightCard({ insight, simulatorState, workspaceId, userId, onDismiss, onRefresh, notify }: Props) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      // Simulate is instant/deterministic, but we use a small timeout for UI effect if needed
      if (insight.actionType && insight.actionPayload) {
        const res = simulateActionImpact(simulatorState, insight.actionType, insight.actionPayload);
        setSimulationResult(res);
      } else {
        notify('error', 'Cannot simulate: No action configured for this insight.');
      }
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleExecute = async () => {
    if (!insight.actionType || !insight.actionPayload) {
      notify('error', 'Cannot execute: No action configured for this insight.');
      return;
    }
    
    setIsExecuting(true);
    try {
      // High-risk actions like reassignment or deadlines require approval
      const isHighRisk = ['TASK_REASSIGNMENT', 'DEADLINE_ADJUSTMENT'].includes(insight.actionType);
      
      const res = await executeDecisionAction(
        workspaceId,
        userId,
        insight,
        isHighRisk
      );

      if (res.success) {
        notify('success', res.message);
        if (res.requiresApproval) {
          // If approval requested, user can be dismissed or marked pending
          onDismiss(insight.id);
        } else {
          onRefresh();
        }
      } else {
        notify('error', res.message);
      }
    } catch (err: any) {
      notify('error', err.message || 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="flex flex-col p-4 rounded-xl border bg-surface-2 transition-colors hover:border-indigo-500/30"
      style={{
        borderColor: insight.severity === 'critical' ? 'var(--signal-critical)' : 'var(--border-subtle)',
        borderLeftWidth: '4px',
        borderLeftColor: insight.severity === 'critical' ? 'var(--signal-critical)' : 
                        insight.severity === 'warning' ? 'var(--signal-warning)' : 'var(--signal-info)'
      }}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            <Icon name={insight.severity === 'critical' ? 'error' : insight.severity === 'warning' ? 'warning' : 'info'} size={20} 
              style={{ color: insight.severity === 'critical' ? 'var(--signal-critical)' : insight.severity === 'warning' ? 'var(--signal-warning)' : 'var(--signal-info)' }} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-semibold text-white">{insight.title}</h4>
              <span className="text-[9px] font-mono-pm px-1.5 py-0.5 rounded-sm bg-surface-3 text-[var(--text-secondary)] border border-border" title={insight.confidenceExplanation}>
                CONFIDENCE: {insight.confidence}%
              </span>
            </div>
            <ul className="text-xs text-[var(--text-secondary)] list-disc list-inside mb-2 space-y-0.5">
              {insight.cause.map((c, idx) => (
                <li key={idx}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex gap-2">
          {insight.actionType && (
            <button 
              onClick={handleSimulate}
              disabled={isSimulating}
              className="px-3 py-1.5 rounded bg-[var(--pm-surface)]/10 hover:bg-[var(--pm-surface)]/20 text-xs font-medium text-white transition-colors border border-border whitespace-nowrap shrink-0"
            >
              Simulate
            </button>
          )}
          {insight.actionRoute && !insight.actionType && (
            <button onClick={() => { replace(insight.actionRoute!); }} className="px-3 py-1.5 rounded bg-[var(--pm-surface)]/10 hover:bg-[var(--pm-surface)]/20 text-xs font-medium text-white transition-colors border border-border whitespace-nowrap shrink-0">
              {insight.actionLabel || 'Take Action'}
            </button>
          )}
          {insight.actionType && (
            <button 
              onClick={handleExecute}
              disabled={isExecuting}
              className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
            >
              Approve Fix
            </button>
          )}
          <button 
            onClick={() => onDismiss(insight.id)}
            className="px-2 py-1.5 rounded hover:bg-white/10 text-xs font-medium text-[var(--text-tertiary)] transition-colors shrink-0"
          >
            Dismiss
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 px-3 py-3 rounded bg-[var(--pm-surface-highest)] border border-border/50">
          <div className="flex items-center gap-2">
            <Icon name="lightbulb" size={14} className="text-amber-400" />
            <span className="text-xs text-[var(--text-primary)]"><strong className="text-white">Recommendation:</strong> {insight.recommendation}</span>
          </div>

          {(insight.whyNow || insight.whyThisFix || insight.whatIfIgnored) && (
            <div className="mt-1 pl-5 space-y-2">
              {insight.whyNow && (
                <div className="text-[11px] text-[var(--text-secondary)] border-l-2 border-amber-500/30 pl-2">
                  <strong className="text-white uppercase tracking-wider text-[9px] block mb-0.5">Why Now?</strong>
                  {insight.whyNow}
                </div>
              )}
              {insight.whyThisFix && (
                <div className="text-[11px] text-[var(--text-secondary)] border-l-2 border-emerald-500/30 pl-2">
                  <strong className="text-white uppercase tracking-wider text-[9px] block mb-0.5">Why This Fix?</strong>
                  {insight.whyThisFix}
                </div>
              )}
              {insight.whatIfIgnored && (
                <div className="text-[11px] text-[var(--text-secondary)] border-l-2 border-red-500/30 pl-2">
                  <strong className="text-white uppercase tracking-wider text-[9px] block mb-0.5">What If Ignored?</strong>
                  {insight.whatIfIgnored}
                </div>
              )}
            </div>
          )}

          <div className="mt-1 flex items-center pt-2 border-t border-border/50">
            <span className="text-[11px] text-[var(--text-secondary)]"><strong className="text-[var(--text-tertiary)]">Expected Impact:</strong> {insight.expectedImpactText}</span>
          </div>
        </div>
        
        {insight.reasoning && (
          <div className="px-3 py-2 text-xs text-[var(--text-secondary)]">
            <strong>Reasoning:</strong> {insight.reasoning}
          </div>
        )}

        {simulationResult && (
          <div className="px-3 py-2 mt-2 bg-indigo-500/10 border border-indigo-500/30 rounded text-xs">
            <h5 className="font-bold text-indigo-300 mb-1">Simulation Results:</h5>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[var(--text-secondary)]">Before:</p>
                <p>Delivery Confidence: {simulationResult.before.deliveryConfidence}%</p>
                <p>Overloaded Users: {simulationResult.before.overloadedUsers}</p>
              </div>
              <div>
                <p className="text-[var(--text-secondary)]">After <span className="text-emerald-400">(Predicted)</span>:</p>
                <p>Delivery Confidence: <span className="text-emerald-400">{simulationResult.after.deliveryConfidence}%</span></p>
                <p>Overloaded Users: <span className="text-emerald-400">{simulationResult.after.overloadedUsers}</span></p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
