import { useMemo } from 'react';
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

export default function MissionControlPage() {
  const { profile } = useAuth();
  const { workspace } = useWorkspace();

  const wsId = workspace?.id || '';

  const presence = useOperationalPresence({
    userId: profile?.id || '',
    role: profile?.role || 'viewer',
    username: profile?.full_name || profile?.email || '',
    ownerProjectIds: [],
  });

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

  const activeCount = useMemo(
    () => presence.collaborators.filter(c => !c.idle).length,
    [presence.collaborators],
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Mission Control</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {activeCount} active contributor{activeCount !== 1 ? 's' : ''} · workspace operational intelligence
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <span className="w-2 h-2 rounded-full bg-emerald-300" />
          vitality {coordination.vitality.overall}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <VitalityOverview vitality={coordination.vitality} />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <CoordinationRadar density={coordination.density} signals={presence.signals} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <OperationalTopologyMap
              presences={presence.collaborators}
              signals={presence.signals}
              hotspots={coordination.hotspots}
            />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <OrganizationalFlowMap
              presences={presence.collaborators}
              signals={presence.signals}
              feed={presence.feed}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <ExecutionPressureZones
              bottlenecks={coordination.bottlenecks}
              hotspots={coordination.hotspots}
              vitality={coordination.vitality}
            />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <DependencyRiskPanel predictions={predictions} insights={allInsights} />
          </div>
        </div>
      </div>

      {allInsights.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold pb-2 border-b border-gray-100 mb-2">
            operational intelligence
          </div>
          <div className="space-y-1.5">
            {allInsights.slice(0, 6).map(insight => {
              let dotColor = 'bg-blue-300';
              if (insight.severity === 'warning' || insight.severity === 'critical') dotColor = 'bg-amber-400';
              else if (insight.severity === 'notice') dotColor = 'bg-indigo-300';

              return (
                <div key={insight.id} className="flex items-start gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${dotColor}`} />
                  <div>
                    <p className="text-[11px] font-medium text-gray-700">{insight.title}</p>
                    <p className="text-[10px] text-gray-500">{insight.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
