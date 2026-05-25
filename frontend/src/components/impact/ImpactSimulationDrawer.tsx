import React, { useState } from 'react';
import { AlertTriangle, BrainCircuit, Activity, Clock, Check, X, ArrowRight, Users, GitBranch, Zap } from 'lucide-react';
import type { ImpactSimulation, AIMitigation, SimulationSeverity } from '../../services/impactSimulationService';

interface Props {
  simulation: ImpactSimulation | null;
  onApply: (simulationId: string) => void;
  onDismiss: (simulationId: string) => void;
  onApplyMitigation: (simulationId: string, mitigationType: AIMitigation['type']) => void;
  onClose: () => void;
}

const severityColors: Record<SimulationSeverity, string> = {
  LOW: 'text-signal-info border-border bg-surface-3',
  MEDIUM: 'text-signal-warning border-border bg-signal-warning-bg',
  HIGH: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
  CRITICAL: 'text-signal-critical border-red-500/30 bg-signal-critical-bg'
};

export function ImpactSimulationDrawer({ simulation, onApply, onDismiss, onApplyMitigation, onClose }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const [applying, setApplying] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  if (!simulation) return null;

  const isExpired = simulation.status === 'expired' || new Date(simulation.expires_at) < new Date();
  const isStale = simulation.stale;
  const isInactive = isExpired || isStale || simulation.status !== 'pending';

  const riskColor = simulation.risk_delta > 0 ? 'text-rose-400' : simulation.risk_delta < 0 ? 'text-emerald-400' : 'text-text-tertiary';
  const confColor = simulation.confidence_delta < 0 ? 'text-rose-400' : simulation.confidence_delta > 0 ? 'text-emerald-400' : 'text-text-tertiary';
  const delayColor = simulation.eta_delta > 0 ? 'text-signal-warning' : simulation.eta_delta < 0 ? 'text-emerald-400' : 'text-text-tertiary';

  const handleApply = async () => {
    setApplying(true);
    await onApply(simulation.id);
    setApplying(false);
  };

  const handleDismiss = async () => {
    setDismissing(true);
    await onDismiss(simulation.id);
    setDismissing(false);
  };

  return (
    <div className="fixed bottom-6 right-6 w-[420px] max-h-[85vh] bg-[#0c0d14]/95 border border-border rounded-xl shadow-2xl backdrop-blur-xl z-50 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-[#07080e]/50">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-cyan-400" />
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-text-secondary">Impact Simulation</span>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${severityColors[simulation.severity]}`}>{simulation.severity}</span>
        </div>
        <button onClick={onClose} className="text-text-quaternary hover:text-text-secondary transition-colors cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {isInactive && (
        <div className="mx-4 mt-3 px-3 py-2 bg-signal-warning-bg border border-border rounded-lg">
          <p className="text-[10px] font-mono text-signal-warning">
            {isExpired ? 'This simulation has expired. Regenerate to see current impact.' : ''}
            {isStale && !isExpired ? (simulation.stale_reason ? `Data changed: ${simulation.stale_reason}` : 'Underlying data changed. This simulation is stale.') : ''}
            {simulation.status === 'accepted' ? 'Changes have been applied.' : ''}
            {simulation.status === 'dismissed' ? 'Simulation was dismissed.' : ''}
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 rounded-lg p-3 border border-border-subtle">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-quaternary uppercase mb-1">
              <Activity className="w-3 h-3" />
              Affected Tasks
            </div>
            <div className="text-lg font-bold text-text-primary">{simulation.affected_entities.length}</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-border-subtle">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-quaternary uppercase mb-1">
              <Clock className="w-3 h-3" />
              Release Delay
            </div>
            <div className={`text-lg font-bold ${delayColor}`}>{simulation.release_delta > 0 ? `+${simulation.release_delta}d` : '0d'}</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-border-subtle">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-quaternary uppercase mb-1">
              <AlertTriangle className="w-3 h-3" />
              Confidence
            </div>
            <div className={`text-lg font-bold ${confColor}`}>{simulation.confidence_delta >= 0 ? '+' : ''}{simulation.confidence_delta}%</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-border-subtle">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-quaternary uppercase mb-1">
              <GitBranch className="w-3 h-3" />
              Risk
            </div>
            <div className={`text-lg font-bold ${riskColor}`}>{simulation.risk_delta > 0 ? 'HIGH' : simulation.risk_delta < 0 ? 'LOWER' : 'STABLE'}</div>
          </div>
        </div>

        <div className="bg-white/5 rounded-lg p-3 border border-border-subtle">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-quaternary uppercase mb-1">
            <Users className="w-3 h-3" />
            Dependency Cascades
          </div>
          <div className="text-lg font-bold text-text-primary">{simulation.affected_entities.length - (simulation.trigger_id ? 1 : 0)}</div>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-text-quaternary">
          <span>Trigger: {simulation.trigger_type}</span>
          <span>Expires: {new Date(simulation.expires_at).toLocaleDateString()}</span>
        </div>

        {simulation.mitigations.length > 0 && (
          <div>
            <div className="text-[10px] font-mono text-cyan-400/60 uppercase tracking-wider mb-2">AI Mitigations</div>
            <div className="space-y-1.5">
              {simulation.mitigations.map(m => (
                <div key={m.type} className={`flex items-center justify-between px-3 py-2 rounded-md border text-[11px] transition-all ${
                  m.status === 'accepted' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                  m.status === 'rejected' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                  'bg-white/5 border-border text-text-secondary hover:border-cyan-500/30'
                }`}>
                  <div className="flex-1 min-w-0 mr-2">
                    <div className="font-medium truncate">{m.label}</div>
                    <div className="text-[9px] text-text-quaternary truncate">{m.description}</div>
                  </div>
                  {m.status === 'pending' && !isInactive && (
                    <button onClick={() => onApplyMitigation(simulation.id, m.type)} className="shrink-0 flex items-center gap-1 px-2 py-1 text-[9px] font-mono uppercase tracking-wider bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 rounded hover:bg-cyan-500/25 transition-all cursor-pointer">
                      <Check className="w-2.5 h-2.5" />
                      Apply
                    </button>
                  )}
                  {m.status === 'accepted' && <span className="text-[9px] font-mono text-emerald-500">Applied</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {showDetails && (
          <div className="bg-white/5 rounded-lg border border-border divide-y divide-white/5 max-h-48 overflow-y-auto">
            {simulation.affected_entities.map(e => (
              <div key={e.taskId} className="px-3 py-2 flex items-center justify-between text-[11px]">
                <span className="text-text-secondary truncate mr-2">{e.taskName}</span>
                <span className={`shrink-0 font-mono ${e.deltaDays > 0 ? 'text-signal-warning' : e.deltaDays < 0 ? 'text-emerald-400' : 'text-text-quaternary'}`}>
                  {e.deltaDays > 0 ? `+${e.deltaDays}d` : e.deltaDays < 0 ? `${e.deltaDays}d` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-[#07080e]/50">
        <button onClick={handleDismiss} disabled={dismissing || isInactive} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-medium uppercase tracking-wider border border-white/15 text-text-tertiary rounded-md hover:text-text-secondary hover:border-white/30 transition-all cursor-pointer disabled:opacity-40">
          <X className="w-3 h-3" />
          {isInactive ? 'Close' : 'Ignore'}
        </button>
        <button onClick={() => setShowDetails(v => !v)} className="flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-mono uppercase tracking-wider border border-border text-text-tertiary rounded-md hover:text-cyan-400 hover:border-cyan-500/30 transition-all cursor-pointer">
          <ArrowRight className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-90' : ''}`} />
          Preview
        </button>
        <button onClick={handleApply} disabled={applying || isInactive} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-medium uppercase tracking-wider bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 rounded-md hover:bg-cyan-500/25 transition-all cursor-pointer disabled:opacity-40">
          <Check className="w-3 h-3" />
          Apply Changes
        </button>
      </div>
    </div>
  );
}
