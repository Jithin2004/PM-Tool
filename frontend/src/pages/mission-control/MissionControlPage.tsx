import { useMemo, useState } from 'react';
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
import { DensityProvider, useDensity } from '../../core/ui/DensityProvider';
import { getMissionFocus } from '../../core/mission-control/operationalFocus';
import { getFocusConfig } from '../../core/dashboard/contextualFocus';
import type { MissionControlView } from '../../core/mission-control/operationalFocus';
import { TYPESCALE } from '../../design/typographyScale';
import { SPACING } from '../../design/spacingSystem';

function MissionControlContent() {
  const { profile } = useAuth();
  const { workspace } = useWorkspace();
  const { tokens } = useDensity();
  const [view, setView] = useState<MissionControlView>('strategic');

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

  const missionFocus = getMissionFocus(view);
  const focusConfig = getFocusConfig(missionFocus.focusMode);

  const activeCount = useMemo(
    () => presence.collaborators.filter(c => !c.idle).length,
    [presence.collaborators],
  );

  const criticalInsights = allInsights.filter(i => i.severity === 'critical' || i.severity === 'warning').slice(0, 4);
  const otherInsights = allInsights.filter(i => i.severity !== 'critical' && i.severity !== 'warning');

  return (
    <div style={{ padding: tokens.panel, maxWidth: '1440px', margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: tokens.gap,
        marginBottom: tokens.sectionGap,
        borderBottom: '1px solid var(--border)',
      }}>
        <div>
          <h1 style={{ ...TYPESCALE.display, margin: 0, color: 'var(--text-primary)' }}>Mission Control</h1>
          <p style={{ ...TYPESCALE.caption, marginTop: 4, color: 'var(--text-tertiary)' }}>
            {activeCount} active contributor{activeCount !== 1 ? 's' : ''} · {missionFocus.label}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['strategic', 'tactical', 'diagnostic'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '4px 12px',
                  fontSize: TYPESCALE.telemetry.size,
                  fontWeight: view === v ? 600 : 400,
                  letterSpacing: TYPESCALE.telemetry.letterSpacing,
                  textTransform: 'uppercase',
                  background: view === v ? 'var(--accent-primary)' : 'transparent',
                  color: view === v ? 'var(--bg)' : 'var(--text-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {v}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: coordination.vitality.overall >= 70 ? 'var(--signal-safe)' : coordination.vitality.overall >= 40 ? 'var(--signal-warning)' : 'var(--signal-critical)',
            }} />
            <span style={{ fontSize: TYPESCALE.caption.size, color: 'var(--text-secondary)' }}>
              vitality {coordination.vitality.overall}
            </span>
          </div>
        </div>
      </div>

      {focusConfig.showPrimary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: tokens.gap,
          marginBottom: tokens.sectionGap,
        }}>
          <div style={{ padding: tokens.panel, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <VitalityOverview vitality={coordination.vitality} />
          </div>
          <div style={{ padding: tokens.panel, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <ExecutionPressureZones
              bottlenecks={coordination.bottlenecks}
              hotspots={coordination.hotspots}
              vitality={coordination.vitality}
            />
          </div>
          <div style={{ padding: tokens.panel, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <CoordinationRadar density={coordination.density} signals={presence.signals} />
          </div>
        </div>
      )}

      {focusConfig.showSecondary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: tokens.gap,
          marginBottom: tokens.sectionGap,
        }}>
          <div style={{ padding: tokens.panel, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <OperationalTopologyMap
              presences={presence.collaborators}
              signals={presence.signals}
              hotspots={coordination.hotspots}
            />
          </div>
          <div style={{ padding: tokens.panel, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <OrganizationalFlowMap
              presences={presence.collaborators}
              signals={presence.signals}
              feed={presence.feed}
            />
          </div>
          <div style={{ padding: tokens.panel, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <DependencyRiskPanel predictions={predictions} insights={allInsights} />
          </div>
        </div>
      )}

      {focusConfig.showTertiary && criticalInsights.length > 0 && (
        <div style={{
          padding: tokens.panel,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          marginBottom: tokens.sectionGap,
        }}>
          <div style={{
            ...TYPESCALE.label,
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            paddingBottom: tokens.element,
            marginBottom: tokens.element,
            borderBottom: '1px solid var(--border)',
          }}>
            operational intelligence
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {criticalInsights.map(insight => {
              let dotColor = 'var(--signal-info)';
              if (insight.severity === 'warning') dotColor = 'var(--signal-warning)';
              else if (insight.severity === 'critical') dotColor = 'var(--signal-critical)';

              return (
                <div key={insight.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', background: dotColor,
                    marginTop: 4, flexShrink: 0,
                  }} />
                  <div>
                    <p style={{ ...TYPESCALE.bodySmall, fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>
                      {insight.title}
                    </p>
                    <p style={{ ...TYPESCALE.caption, margin: 0, color: 'var(--text-tertiary)' }}>
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
        <div style={{
          padding: tokens.panel,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
        }}>
          <div style={{
            ...TYPESCALE.label,
            textTransform: 'uppercase',
            color: 'var(--text-quaternary)',
            paddingBottom: tokens.element,
            marginBottom: tokens.element,
            borderBottom: '1px solid var(--border)',
          }}>
            additional signals
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {otherInsights.slice(0, 3).map(insight => (
              <div key={insight.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-quaternary)', marginTop: 5, flexShrink: 0 }} />
                <p style={{ ...TYPESCALE.caption, margin: 0, color: 'var(--text-tertiary)' }}>
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
