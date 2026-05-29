import { useMemo, useState, useEffect } from 'react';
import { useOperationalPresence } from '../../core/presence/presenceEngine';
import { useCoordinationEngine } from '../../core/coordination/coordinationEngine';
import { generateCoordinationInsights } from '../../core/ai/coordinationInsights';
import { forecastCoordinationTrend } from '../../core/ai/operationalForecasting';
import { analyzeExecutionRisks } from '../../core/ai/executionRiskAnalysis';
import { forecastCoordination } from '../../core/prediction/coordinationForecasting';
import { predictSprintInstability } from '../../core/prediction/sprintInstability';
import { predictOverload } from '../../core/prediction/overloadPrediction';
import { forecastDependencyRisk } from '../../core/prediction/dependencyRiskForecast';
import { VitalityOverview } from '../../components/mission-control/VitalityOverview';
import { CoordinationRadar } from '../../components/mission-control/CoordinationRadar';
import { OperationalTopologyMap } from '../../components/mission-control/OperationalTopologyMap';
import { ExecutionPressureZones } from '../../components/mission-control/ExecutionPressureZones';
import { DependencyRiskPanel } from '../../components/mission-control/DependencyRiskPanel';
import { OrganizationalFlowMap } from '../../components/mission-control/OrganizationalFlowMap';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { DensityProvider } from '../../core/ui/DensityProvider';
import { getMissionFocus } from '../../core/mission-control/operationalFocus';
import { getFocusConfig } from '../../core/dashboard/contextualFocus';
import type { MissionControlView } from '../../core/mission-control/operationalFocus';
import type { OperationalPresence } from '../../core/presence/types';

function MissionControlContent() {
  const { profile } = useAuth();
  const { workspace } = useWorkspace();
  const { raw } = useOperationalData();
  const [view, setView] = useState<MissionControlView>('strategic');

  const presence = useOperationalPresence({
    userId: profile?.id || '',
    role: profile?.role || 'viewer',
    username: profile?.full_name || profile?.email || '',
    ownerProjectIds: [],
  });

  // Seed the presence engine with actual profiles so the charts aren't empty zeroes
  useEffect(() => {
    raw.profiles.forEach(p => {
      presence.addCollaborator({
        userId: p.id,
        username: p.full_name || p.email?.split('@')[0] || 'Unknown',
        role: p.role,
        state: 'active',
        context: { section: 'workspace' },
        intent: 'general',
        onlineAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        idle: false,
      });
    });
  }, [raw.profiles, presence.addCollaborator]);

  const coordination = useCoordinationEngine({
    presences: presence.collaborators,
    signals: presence.signals,
    feed: presence.feed,
    projectId: presence.myPresence.context.projectId,
  });

  const insights = useMemo(
    () => generateCoordinationInsights(
      coordination.density,
      coordination.patterns,
      coordination.bottlenecks,
      coordination.vitality,
      presence.signals,
    ),
    [coordination.density, coordination.patterns, coordination.bottlenecks, coordination.vitality, presence.signals],
  );

  const forecasts = useMemo(
    () => forecastCoordinationTrend(presence.signals, presence.feed),
    [presence.signals, presence.feed],
  );

  const riskInsights = useMemo(
    () => analyzeExecutionRisks(
      presence.collaborators,
      presence.signals,
      presence.feed,
      coordination.vitality,
      coordination.bottlenecks,
    ),
    [presence.collaborators, presence.signals, presence.feed, coordination.vitality, coordination.bottlenecks],
  );

  const predictions = useMemo(() => {
    const allPredictions = [
      ...forecastCoordination(presence.signals, presence.feed, coordination.vitality),
      ...predictSprintInstability(presence.signals, presence.feed, coordination.vitality),
      ...predictOverload(presence.collaborators, presence.signals, presence.feed),
      ...forecastDependencyRisk(presence.signals, presence.feed),
    ];
    return allPredictions.sort((a, b) => b.probability - a.probability);
  }, [presence.collaborators, presence.signals, presence.feed, coordination.vitality]);

  const allInsights = useMemo(
    () => [...insights, ...riskInsights].sort((a, b) => {
      const order = { critical: 0, warning: 1, notice: 2, info: 3 };
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
    }),
    [insights, riskInsights],
  );

  const missionFocus = getMissionFocus(view);
  const focusConfig = getFocusConfig(missionFocus.focusMode);

  const activeCount = useMemo(
    () => presence.collaborators.filter(c => !c.idle).length,
    [presence.collaborators],
  );

  const criticalInsights = allInsights.filter(i => i.severity === 'critical' || i.severity === 'warning').slice(0, 4);
  const otherInsights = allInsights.filter(i => i.severity !== 'critical' && i.severity !== 'warning');

  return (
    <div className="p-6 sm:p-10 max-w-[1600px] mx-auto font-geist animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-8 mb-10 border-b border-border/50 gap-6">
        <div className="relative">
          <div className="absolute -inset-2 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-transparent blur-3xl opacity-50 -z-10" />
          <h1 className="text-4xl font-semibold tracking-tight text-text-primary mb-2">Mission Control</h1>
          <p className="text-sm mt-1 text-text-tertiary flex items-center gap-3">
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-signal-safe shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" /> {activeCount} active contributor{activeCount !== 1 ? 's' : ''}</span>
            <span className="text-border">|</span>
            <span className="uppercase tracking-widest text-[10px] font-bold text-text-secondary">{missionFocus.label}</span>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex bg-surface-3/50 p-1 rounded-xl border border-border/50">
            {(['strategic', 'tactical', 'diagnostic'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-5 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all duration-300 ${
                  view === v 
                    ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20 scale-100' 
                    : 'bg-transparent text-text-tertiary hover:text-text-secondary hover:bg-white/5 scale-95'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 bg-surface/50 border border-border/50 px-4 py-2 rounded-xl backdrop-blur-md">
            <span className={`w-2.5 h-2.5 rounded-full shadow-lg ${
              coordination.vitality.overall >= 70 ? 'bg-signal-safe shadow-signal-safe/40' 
              : coordination.vitality.overall >= 40 ? 'bg-signal-warning shadow-signal-warning/40' 
              : 'bg-signal-critical shadow-signal-critical/40'
            }`} />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-quaternary">System Vitality</span>
              <span className="text-sm font-bold text-text-primary leading-none mt-0.5">
                {coordination.vitality.overall}<span className="text-text-quaternary text-[10px]">/100</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {focusConfig.showPrimary && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          <div className="relative group p-6 bg-surface/40 backdrop-blur-md border border-border/50 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-500 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
            <div className="relative z-10"><VitalityOverview vitality={coordination.vitality} /></div>
          </div>
          <div className="relative group p-6 bg-surface/40 backdrop-blur-md border border-border/50 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-500 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
            <div className="relative z-10"><ExecutionPressureZones bottlenecks={coordination.bottlenecks} hotspots={coordination.hotspots} vitality={coordination.vitality} /></div>
          </div>
          <div className="relative group p-6 bg-surface/40 backdrop-blur-md border border-border/50 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-500 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
            <div className="relative z-10"><CoordinationRadar density={coordination.density} signals={presence.signals} /></div>
          </div>
        </div>
      )}

      {focusConfig.showSecondary && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          <div className="relative group p-6 bg-surface/40 backdrop-blur-md border border-border/50 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-500 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
            <div className="relative z-10"><OperationalTopologyMap presences={presence.collaborators} signals={presence.signals} hotspots={coordination.hotspots} /></div>
          </div>
          <div className="relative group p-6 bg-surface/40 backdrop-blur-md border border-border/50 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-500 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
            <div className="relative z-10"><OrganizationalFlowMap presences={presence.collaborators} signals={presence.signals} feed={presence.feed} /></div>
          </div>
          <div className="relative group p-6 bg-surface/40 backdrop-blur-md border border-border/50 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-500 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
            <div className="relative z-10"><DependencyRiskPanel predictions={predictions} insights={allInsights} /></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {focusConfig.showTertiary && criticalInsights.length > 0 && (
          <div className="relative group p-6 bg-surface/40 backdrop-blur-md border border-border/50 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-500 overflow-hidden h-full">
            <div className="absolute inset-0 bg-gradient-to-b from-red-500/[0.02] to-transparent pointer-events-none" />
            <div className="relative z-10">
              <div className="text-[11px] font-bold uppercase tracking-widest text-text-secondary pb-4 mb-5 border-b border-border/50 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-signal-critical animate-pulse" />
                Operational Intelligence
              </div>
              <div className="flex flex-col gap-4">
                {criticalInsights.map(insight => {
                  let dotColor = 'bg-signal-info';
                  if (insight.severity === 'warning') dotColor = 'bg-signal-warning shadow-[0_0_8px_rgba(245,158,11,0.5)]';
                  else if (insight.severity === 'critical') dotColor = 'bg-signal-critical shadow-[0_0_8px_rgba(239,68,68,0.5)]';

                  return (
                    <div key={insight.id} className="flex gap-4 items-start bg-surface-3/50 p-4 rounded-xl border border-border/30 hover:border-border/60 transition-colors">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
                      <div>
                        <p className="text-sm font-semibold text-text-primary mb-1">
                          {insight.title}
                        </p>
                        <p className="text-xs text-text-tertiary leading-relaxed">
                          {insight.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {focusConfig.showPassive && otherInsights.length > 0 && (
          <div className="relative group p-6 bg-surface/40 backdrop-blur-md border border-border/50 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-500 overflow-hidden h-full">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
            <div className="relative z-10">
              <div className="text-[11px] font-bold uppercase tracking-widest text-text-tertiary pb-4 mb-5 border-b border-border/50 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-text-quaternary" />
                Additional Signals
              </div>
              <div className="flex flex-col gap-3">
                {otherInsights.slice(0, 5).map(insight => (
                  <div key={insight.id} className="flex gap-3 items-center bg-surface-3/30 p-3 rounded-lg hover:bg-surface-3/60 transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-text-quaternary" />
                    <p className="text-xs font-medium text-text-tertiary m-0">
                      {insight.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MissionControlPage() {
  return (
    <DensityProvider surface="mission-control">
      <MissionControlContent />
    </DensityProvider>
  );
}
