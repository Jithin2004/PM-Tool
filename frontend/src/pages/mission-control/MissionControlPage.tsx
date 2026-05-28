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
    <div className="p-6 max-w-[1440px] mx-auto font-geist">
      <div className="flex items-center justify-between pb-6 mb-8 border-b border-border">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Mission Control</h1>
          <p className="text-xs mt-1 text-text-tertiary">
            {activeCount} active contributor{activeCount !== 1 ? 's' : ''} · {missionFocus.label}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            {(['strategic', 'tactical', 'diagnostic'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 text-[10px] uppercase tracking-wider rounded border transition-colors ${
                  view === v 
                    ? 'bg-accent-primary text-bg border-accent-primary font-semibold' 
                    : 'bg-transparent text-text-tertiary border-border hover:bg-white/5'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              coordination.vitality.overall >= 70 ? 'bg-signal-safe' 
              : coordination.vitality.overall >= 40 ? 'bg-signal-warning' 
              : 'bg-signal-critical'
            }`} />
            <span className="text-xs text-text-secondary">
              vitality {coordination.vitality.overall}
            </span>
          </div>
        </div>
      </div>

      {focusConfig.showPrimary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="p-6 bg-surface-2 border border-border rounded-xl">
            <VitalityOverview vitality={coordination.vitality} />
          </div>
          <div className="p-6 bg-surface-2 border border-border rounded-xl">
            <ExecutionPressureZones
              bottlenecks={coordination.bottlenecks}
              hotspots={coordination.hotspots}
              vitality={coordination.vitality}
            />
          </div>
          <div className="p-6 bg-surface-2 border border-border rounded-xl">
            <CoordinationRadar density={coordination.density} signals={presence.signals} />
          </div>
        </div>
      )}

      {focusConfig.showSecondary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="p-6 bg-surface-2 border border-border rounded-xl">
            <OperationalTopologyMap
              presences={presence.collaborators}
              signals={presence.signals}
              hotspots={coordination.hotspots}
            />
          </div>
          <div className="p-6 bg-surface-2 border border-border rounded-xl">
            <OrganizationalFlowMap
              presences={presence.collaborators}
              signals={presence.signals}
              feed={presence.feed}
            />
          </div>
          <div className="p-6 bg-surface-2 border border-border rounded-xl">
            <DependencyRiskPanel predictions={predictions} insights={allInsights} />
          </div>
        </div>
      )}

      {focusConfig.showTertiary && criticalInsights.length > 0 && (
        <div className="p-6 bg-surface-2 border border-border rounded-xl mb-8">
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary pb-4 mb-4 border-b border-border">
            operational intelligence
          </div>
          <div className="flex flex-col gap-3">
            {criticalInsights.map(insight => {
              let dotColor = 'bg-signal-info';
              if (insight.severity === 'warning') dotColor = 'bg-signal-warning';
              else if (insight.severity === 'critical') dotColor = 'bg-signal-critical';

              return (
                <div key={insight.id} className="flex gap-3 items-start">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
                  <div>
                    <p className="text-sm font-medium m-0 text-text-primary">
                      {insight.title}
                    </p>
                    <p className="text-xs m-0 text-text-tertiary">
                      {insight.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {focusConfig.showPassive && otherInsights.length > 0 && (
        <div className="p-6 bg-surface-2 border border-border rounded-xl">
          <div className="text-[10px] uppercase tracking-wider text-text-quaternary pb-4 mb-4 border-b border-border">
            additional signals
          </div>
          <div className="flex flex-col gap-2">
            {otherInsights.slice(0, 3).map(insight => (
              <div key={insight.id} className="flex gap-2 items-start">
                <span className="w-1 h-1 rounded-full mt-1.5 shrink-0 bg-text-quaternary" />
                <p className="text-xs m-0 text-text-tertiary">
                  {insight.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
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
