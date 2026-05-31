import React, { useState, useEffect, useMemo } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { useAuth } from '../../context/AuthContext';
import { hasCapability } from '../../core/auth/permissions';
import { buildOperationalReplay, OperationalReplay } from '../../core/execution/resilienceEngine';
import { activityLogService } from '../../services/activityLogService';
import { DataGovernanceEngine } from '../../core/governance/dataGovernanceEngine';
import { 
  Activity, 
  Shield, 
  History, 
  Zap, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Eye, 
  HelpCircle, 
  Sliders, 
  Play,
  RotateCcw,
  Search,
  UserCheck,
  Info,
  ArrowRight
} from 'lucide-react';

const AuditView = React.memo(function AuditView() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const wsId = workspace?.id || '';
  const userRole = profile?.role || 'viewer';
  const userId = profile?.id || '';

  // Capabilities
  const isSuperAdmin = hasCapability(userRole, 'platform_governance');
  const isPM = hasCapability(userRole, 'manage_projects') && !isSuperAdmin;
  const isDeveloper = hasCapability(userRole, 'manage_tasks') && !hasCapability(userRole, 'manage_projects');
  const isStakeholder = userRole === 'viewer';

  const { 
    raw: { projects, tasks, teams, profiles, workspaceSettingsBlob },
    governanceCache
  } = useOperationalData();

  const [chainStatus, setChainStatus] = useState<{ status: string; logCount: number; message: string } | null>(null);
  const [logsLoading, setLogsLoading] = useState(true);
  const [historicalBlockers, setHistoricalBlockers] = useState<any[]>([]);
  const [hydratingHistory, setHydratingHistory] = useState(false);

  // Load backend SHA-256 chain status for authenticity audit
  useEffect(() => {
    if (!wsId) return;
    setLogsLoading(true);
    activityLogService.verifyHashChain(wsId)
      .then((chain) => {
        setChainStatus({ status: chain.status, logCount: chain.logCount, message: chain.message });
      })
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  }, [wsId]);

  // Extract compiled resilience metrics from central governance context
  const res = governanceCache.resilience;

  // Selected project for historical replay
  const [selectedReplayProjectId, setSelectedReplayProjectId] = useState<string>('');

  // Auto-select first project for replay
  useEffect(() => {
    if (projects.length > 0 && !selectedReplayProjectId) {
      setSelectedReplayProjectId(projects[0].id);
    }
  }, [projects, selectedReplayProjectId]);

  // FIX 3 & 7: Replay Reconstruction Optimization & Dependency History
  // Lazy-load historical operational archives for the selected replay window
  useEffect(() => {
    if (!wsId || !selectedReplayProjectId) return;
    
    let active = true;
    setHydratingHistory(true);
    
    // Define the replay window (e.g. past 1 year)
    const toDate = new Date().toISOString();
    const fromDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    
    DataGovernanceEngine.loadHistoricalWindow(wsId, 'blocker_archive', fromDate, toDate)
      .then((archives) => {
        if (!active) return;
        // Flatten the payloads since each payload is an array of archived blockers
        const mergedBlockers = archives.flatMap(a => Array.isArray(a) ? a : []);
        setHistoricalBlockers(mergedBlockers);
        setHydratingHistory(false);
      })
      .catch((err) => {
        console.error('Failed to hydrate historical blockers', err);
        if (active) setHydratingHistory(false);
      });
      
    return () => { active = false; };
  }, [wsId, selectedReplayProjectId]);

  const replayData = useMemo(() => {
    if (!selectedReplayProjectId) return null;
    
    // Combine active operational state with historically archived state for complete replay reconstruction
    const activeBlockers = (workspaceSettingsBlob?.execution_blockers as any[]) || [];
    const allBlockers = [...activeBlockers, ...historicalBlockers];
    
    return buildOperationalReplay(
      selectedReplayProjectId, 
      projects, 
      tasks, 
      allBlockers, 
      (workspaceSettingsBlob?.operational_decisions as any[]) || [], 
      res
    );
  }, [selectedReplayProjectId, projects, tasks, workspaceSettingsBlob, res, historicalBlockers]);

  // Dynamic role-aware tab navigation
  const availableTabs = useMemo(() => {
    if (isSuperAdmin) {
      return [
        { id: 'audit', label: 'Audit Trail' },
        { id: 'observability', label: 'System Observability' },
        { id: 'traces', label: 'Execution Traces' },
        { id: 'replay', label: 'Operational Replay' }
      ];
    }
    if (isPM) {
      return [
        { id: 'audit', label: 'Audit Trail' },
        { id: 'observability', label: 'System Observability' },
        { id: 'traces', label: 'Execution Traces' }
      ];
    }
    if (isDeveloper) {
      return [
        { id: 'traces', label: 'My Execution Traces' }
      ];
    }
    // Stakeholder
    return [
      { id: 'observability', label: 'Stability Indicators' },
      { id: 'replay', label: 'Project Replay' }
    ];
  }, [isSuperAdmin, isPM, isDeveloper]);

  const [activeTab, setActiveTab] = useState<string>('');

  useEffect(() => {
    if (availableTabs.length > 0) {
      setActiveTab(availableTabs[0].id);
    }
  }, [availableTabs]);

  // Filtered Traces (Developers only see their own assigned tasks)
  const visibleTraces = useMemo(() => {
    if (isDeveloper) {
      return res.executionTraces.filter(t => {
        const taskObj = tasks.find(tsk => tsk.id === t.taskId);
        return taskObj?.assignee_id === userId;
      });
    }
    return res.executionTraces;
  }, [res.executionTraces, isDeveloper, tasks, userId]);

  // Expanded Trace ID for trace logs view
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);

  if (!wsId) {
    return <div className="flex-1 flex items-center justify-center text-text-tertiary font-mono text-sm">No workspace selected</div>;
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-8 space-y-6 font-geist text-text-primary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight uppercase flex items-center gap-2">
            <Shield className="w-5.5 h-5.5 text-accent-primary" /> Resilience, Auditability &amp; Observability
          </h2>
          <p className="text-[12px] text-text-tertiary">
            Cryptographic audit trails, runtime execution tracing, stability metrics, and operational causal history.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-surface-2 rounded-lg p-1 border border-border">
            {availableTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1 text-[9px] font-bold rounded uppercase tracking-wider transition-all ${
                  activeTab === tab.id 
                    ? 'bg-surface text-text-primary shadow-sm border border-border-subtle' 
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Health / Ledger authenticity Header */}
      {(isSuperAdmin || isPM) && activeTab === 'audit' && (
        <div className="border border-border bg-surface-2/40 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full ${
              chainStatus?.status === 'Valid' ? 'bg-signal-safe animate-pulse' :
              chainStatus?.status === 'CHAIN_REINDEX' ? 'bg-accent-secondary' :
              chainStatus?.status === 'Suspicious' ? 'bg-signal-warning' : 'bg-signal-critical'
            }`} />
            <div>
              <h3 className="text-xs font-bold uppercase text-text-primary">
                Cryptographic Integrity Verification
              </h3>
              <p className="text-[9px] font-mono text-text-tertiary uppercase">
                {chainStatus ? `${chainStatus.logCount} entries verified · status: ${chainStatus.status}` : 'Verifying ledger chains...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {chainStatus && chainStatus.status !== 'Valid' && (
              <button
                onClick={async () => {
                  setLogsLoading(true);
                  try {
                    await activityLogService.repairHashChain(wsId);
                    const chain = await activityLogService.verifyHashChain(wsId);
                    setChainStatus({ status: chain.status, logCount: chain.logCount, message: chain.message });
                  } catch (e: any) {
                    alert(e.message);
                  }
                  setLogsLoading(false);
                }}
                disabled={logsLoading}
                className="px-3 py-1.5 bg-signal-critical/10 text-signal-critical hover:bg-signal-critical hover:text-gray-900 dark:text-white border border-signal-critical/20 rounded text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                {logsLoading ? 'Repairing...' : 'Repair Ledger'}
              </button>
            )}
            {chainStatus && (
              <span className="text-[9px] font-mono text-text-quaternary uppercase">
                Hash: {chainStatus.message}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tab: Audit Trail (Ledger) */}
      {activeTab === 'audit' && (isSuperAdmin || isPM) && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-surface-2 border-b border-border-subtle text-[9px] font-mono uppercase tracking-wider text-text-quaternary">
            <div className="col-span-1">Index</div>
            <div className="col-span-3">Action Type</div>
            <div className="col-span-2">Actor</div>
            <div className="col-span-2">Timestamp</div>
            <div className="col-span-2">Target</div>
            <div className="col-span-2 text-right">Ledger Hash</div>
          </div>
          <div className="divide-y divide-border-subtle max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
            {res.auditEvents.length === 0 ? (
              <div className="px-4 py-8 text-center text-[10px] font-mono text-text-quaternary uppercase">No audit logs processed</div>
            ) : (
              res.auditEvents.map((ae, i) => (
                <div key={ae.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-[10px] font-mono text-text-tertiary hover:bg-white/5 items-center">
                  <div className="col-span-1 text-text-quaternary font-mono">#{(i + 1).toString().padStart(3, '0')}</div>
                  <div className="col-span-3 font-sans font-bold text-text-primary uppercase tracking-tight text-[9px]">{ae.action.replace(/_/g, ' ')}</div>
                  <div className="col-span-2 font-sans font-medium text-text-secondary">{ae.actorName}</div>
                  <div className="col-span-2 text-[9px] text-text-tertiary">{new Date(ae.timestamp).toLocaleString()}</div>
                  <div className="col-span-2 truncate text-text-tertiary font-sans">{ae.rationale || `ID: ${ae.targetId.slice(0, 8)}`}</div>
                  <div className="col-span-2 text-right text-text-quaternary select-all">{ae.hash.slice(0, 16)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Observability */}
      {activeTab === 'observability' && (
        <div className="space-y-6">
          {/* Diagnostic Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {res.observabilitySignals.map(signal => {
              const statusColors = {
                critical: 'text-signal-critical border-signal-critical/20 bg-signal-critical-bg',
                warn: 'text-signal-warning border-signal-warning/20 bg-signal-warning-bg',
                normal: 'text-signal-safe border-signal-safe/20 bg-signal-safe/5'
              };
              const currentStyle = statusColors[signal.status] || statusColors.normal;

              return (
                <div key={signal.metricName} className="bg-surface-2 border border-border p-5 rounded-xl flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest block mb-1">
                      {signal.metricName.replace(/_/g, ' ')}
                    </span>
                    <p className="text-2xl font-bold text-text-primary">
                      {signal.value}
                      {signal.metricName.includes('saturation') && '%'}
                      {signal.metricName.includes('jitter') && 'ms'}
                    </p>
                  </div>
                  <div className="mt-4 pt-2 border-t border-border-subtle/50 flex items-center justify-between">
                    <span className="text-[9px] text-text-secondary leading-snug">{signal.details}</span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase ${currentStyle}`}>
                      {signal.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Continuity Incidents Ledger */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-signal-warning" /> Operational Continuity Incidents
            </h3>
            {res.continuityIncidents.length === 0 ? (
              <div className="text-center py-6 text-text-quaternary text-xs font-mono uppercase">
                No active continuity incidents registered.
              </div>
            ) : (
              <div className="space-y-3">
                {res.continuityIncidents.map(ci => {
                  const severityColors = {
                    critical: 'text-signal-critical bg-signal-critical-bg border-signal-critical/20',
                    high: 'text-signal-warning bg-signal-warning-bg border-signal-warning/20',
                    medium: 'text-accent-secondary bg-surface-3 border-border',
                    low: 'text-signal-safe bg-signal-safe/5 border-signal-safe/20'
                  };
                  return (
                    <div key={ci.id} className="p-3 bg-surface-2 border border-border-subtle rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase ${severityColors[ci.severity]}`}>
                          {ci.severity}
                        </span>
                        <div>
                          <span className="text-xs font-bold text-text-primary">{ci.projectName} · {ci.incidentType.replace(/_/g, ' ')}</span>
                          <p className="text-[10px] text-text-secondary mt-0.5">{ci.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                          ci.mitigated ? 'text-signal-safe border-signal-safe/20 bg-signal-safe/5' : 'text-signal-warning border-signal-warning/20 bg-signal-warning/5'
                        }`}>
                          {ci.mitigated ? 'Mitigation Active' : 'Stalled'}
                        </span>
                        <span className="text-[9px] font-mono text-text-tertiary">{new Date(ci.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Execution Traces */}
      {activeTab === 'traces' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Traces List */}
          <div className="lg:col-span-5 bg-surface border border-border rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <History className="w-4 h-4 text-accent-primary" /> Active Execution Streams
              </h3>
              <p className="text-[10px] text-text-tertiary">Select a task trace path to inspect its lifecycle transitions.</p>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
              {visibleTraces.length === 0 ? (
                <div className="text-center py-6 text-text-quaternary text-xs font-mono uppercase">
                  No active traces found.
                </div>
              ) : (
                visibleTraces.map(trace => {
                  const isSelected = selectedTraceId === trace.id;
                  return (
                    <div 
                      key={trace.id}
                      onClick={() => setSelectedTraceId(trace.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-accent-primary/5 border-accent-primary text-text-primary' 
                          : 'bg-surface-2 border-border-subtle text-text-secondary hover:border-border hover:text-text-primary'
                      }`}
                    >
                      <span className="text-[8px] font-mono text-text-quaternary block uppercase">Task Trace ID: {trace.id.slice(0, 12)}</span>
                      <span className="text-xs font-bold block truncate mt-0.5">{trace.taskName}</span>
                      <span className="text-[9px] text-text-tertiary font-mono block mt-1">
                        {trace.timeline.length} state transitions logged
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Trace Causality Timeline View */}
          <div className="lg:col-span-7 bg-surface border border-border rounded-xl p-5 space-y-4 flex flex-col justify-between">
            {(() => {
              const selectedTrace = visibleTraces.find(t => t.id === selectedTraceId) || (visibleTraces.length > 0 ? visibleTraces[0] : null);
              if (!selectedTrace) {
                return (
                  <div className="flex-1 flex items-center justify-center text-text-quaternary text-xs font-mono uppercase py-12">
                    Select a trace stream to display causality history.
                  </div>
                );
              }

              return (
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  <div className="border-b border-border pb-3">
                    <span className="text-[8px] font-mono text-text-quaternary block uppercase">Causal Flow Analysis</span>
                    <h3 className="text-sm font-bold text-text-primary mt-0.5">{selectedTrace.taskName}</h3>
                  </div>

                  {/* Transition path timeline */}
                  <div className="space-y-3.5 flex-1 max-h-64 overflow-y-auto pr-1 scrollbar-thin py-2">
                    {selectedTrace.timeline.map((step, idx) => (
                      <div key={idx} className="flex gap-3 items-start relative">
                        {idx < selectedTrace.timeline.length - 1 && (
                          <span className="absolute left-2.5 top-5 bottom-[-14px] w-0.5 bg-border-subtle" />
                        )}
                        <span className="w-5.5 h-5.5 rounded-full border border-border bg-surface-2 text-[9px] font-mono font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-text-primary">{step.toState.toUpperCase()}</span>
                            <span className="text-[9px] text-text-quaternary font-mono">{new Date(step.timestamp).toLocaleTimeString()}</span>
                          </div>
                          {step.rationale && (
                            <p className="text-[10px] text-text-secondary leading-snug mt-0.5 italic">"{step.rationale}"</p>
                          )}
                          <span className="text-[8px] text-text-quaternary uppercase block mt-1">actor: {step.actorName}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Causality chain analysis */}
                  {selectedTrace.causalityChain.length > 0 && (
                    <div className="bg-signal-critical-bg/25 border border-signal-critical/10 p-3 rounded-lg mt-4">
                      <span className="text-[9px] font-bold text-signal-critical uppercase tracking-widest block mb-1">Causality &amp; Drift Chain</span>
                      <ul className="list-disc list-inside text-[10px] text-text-secondary space-y-1">
                        {selectedTrace.causalityChain.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Tab: Replayability */}
      {activeTab === 'replay' && (isSuperAdmin || isStakeholder) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left panel selectors */}
          <div className="lg:col-span-4 bg-surface border border-border rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Play className="w-4 h-4 text-accent-secondary animate-pulse" /> Replay Vector Console
              </h3>
              <p className="text-[10px] text-text-tertiary">Select a portfolio track to simulate historical execution snapshots.</p>
            </div>
            <div className="flex flex-col gap-2">
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedReplayProjectId(p.id)}
                  className={`w-full text-left p-3 rounded-lg border text-xs font-bold transition-all ${
                    selectedReplayProjectId === p.id 
                      ? 'bg-accent-secondary/5 border-accent-secondary text-text-primary' 
                      : 'bg-surface-2 border-border-subtle text-text-secondary hover:border-border hover:text-text-primary'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Right panel Replay Sim */}
          <div className="lg:col-span-8 bg-surface border border-border rounded-xl p-5 space-y-4 flex flex-col justify-between">
            {replayData ? (
              <div className="space-y-4">
                <div className="border-b border-border pb-3">
                  <span className="text-[8px] font-mono text-text-quaternary block uppercase">Historical Replay Matrix</span>
                  <h3 className="text-sm font-bold text-text-primary mt-0.5">{replayData.projectName}</h3>
                </div>

                {/* Snapshots progression */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {replayData.snapshots.map((snap, idx) => (
                    <div key={snap.id} className="p-3 bg-surface-2 border border-border-subtle rounded-lg flex flex-col justify-between gap-2 relative">
                      {idx < replayData.snapshots.length - 1 && (
                        <ArrowRight className="absolute right-[-8px] top-1/2 translate-y-[-50%] text-border w-3.5 h-3.5 hidden md:block" />
                      )}
                      <div>
                        <span className="text-[8px] font-mono text-text-quaternary uppercase block">Sim Day {idx * 3 + 1}</span>
                        <span className="text-[9px] text-text-tertiary">{new Date(snap.timestamp).toLocaleDateString()}</span>
                      </div>
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-text-secondary">Pending Tasks</span>
                          <span className="font-bold text-text-primary font-mono">{snap.activeTasksCount}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-text-secondary">Blocked</span>
                          <span className="font-bold text-signal-critical font-mono">{snap.blockedTasksCount}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-text-secondary">Continuity</span>
                          <span className="font-bold text-signal-safe font-mono">{snap.globalContinuityIndex}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Incidents and mitigations outcomes during replay */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-3 border-t border-border">
                  <div>
                    <span className="text-[9px] font-bold text-text-quaternary uppercase tracking-widest block mb-2">Simulation Incidents</span>
                    {replayData.incidents.length === 0 ? (
                      <div className="text-[10px] text-text-quaternary font-mono uppercase italic">Zero timeline drift incidents in simulation.</div>
                    ) : (
                      <div className="space-y-2">
                        {replayData.incidents.map(inc => (
                          <div key={inc.id} className="p-2 bg-surface-2 border border-border rounded text-[10px] flex justify-between items-center">
                            <span className="font-bold text-text-primary">{inc.incidentType.toUpperCase()}</span>
                            <span className="text-[8px] font-mono text-signal-critical bg-signal-critical-bg px-1.5 py-0.5 rounded border border-signal-critical/20 uppercase">
                              +{projects.find(p => p.id === selectedReplayProjectId)?.delay_drift_days || 0}d drift
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-text-quaternary uppercase tracking-widest block mb-2">Simulated Mitigation Recovery</span>
                    {replayData.mitigations.length === 0 ? (
                      <div className="text-[10px] text-text-quaternary font-mono uppercase italic">No mitigations applied in simulation.</div>
                    ) : (
                      <div className="space-y-2">
                        {replayData.mitigations.map(mit => (
                          <div key={mit.id} className="p-2 bg-surface-2 border border-border rounded text-[10px] flex justify-between items-center">
                            <div>
                              <span className="font-bold text-text-primary">{mit.title}</span>
                              <span className="text-[9px] text-text-quaternary block uppercase">Impact Score: {mit.impactScore}%</span>
                            </div>
                            <span className="text-[10px] text-text-secondary font-mono">{mit.actualRecoveryHours || mit.expectedRecoveryHours}h latency</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-text-quaternary text-xs font-mono uppercase py-12">
                No replay datasets loaded.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default AuditView;