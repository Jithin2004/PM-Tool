import { useMemo, useState, useEffect } from 'react';
import { useOperationalPresence } from '../../core/presence/presenceEngine';
import { useCoordinationEngine } from '../../core/coordination/coordinationEngine';
import { generateCoordinationInsights } from '../../core/ai/coordinationInsights';
import { analyzeExecutionRisks } from '../../core/ai/executionRiskAnalysis';
import { predictOverload } from '../../core/prediction/overloadPrediction';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { DensityProvider } from '../../core/ui/DensityProvider';
import { getMissionFocus } from '../../core/mission-control/operationalFocus';
import { getFocusConfig } from '../../core/dashboard/contextualFocus';
import { navigate } from '../../lib/navigation';

// Import core dashboard widget components
import {
  PageShell,
  PageHeader,
  PageContent,
  DashboardWidget,
  DashboardSection,
  InsightCard,
  Card
} from '../../components/core';

// Lucide icons
import { Rocket, KanbanSquare, Users, Settings, ChevronRight } from 'lucide-react';

// Specific widgets
import { VitalityOverview } from '../../components/mission-control/VitalityOverview';
import { CoordinationRadar } from '../../components/mission-control/CoordinationRadar';
import { OperationalTopologyMap } from '../../components/mission-control/OperationalTopologyMap';
import { ExecutionPressureZones } from '../../components/mission-control/ExecutionPressureZones';
import { DependencyRiskPanel } from '../../components/mission-control/DependencyRiskPanel';
import { OrganizationalFlowMap } from '../../components/mission-control/OrganizationalFlowMap';
import { WorkSessionPanel } from '../../components/mission-control/WorkSessionPanel';

function MissionControlContent() {
  const { profile } = useAuth();
  const { workspace } = useWorkspace();
  const { raw } = useOperationalData();
  const [view, setView] = useState<'strategic' | 'tactical' | 'diagnostic'>('strategic');

  const presence = useOperationalPresence({
    userId: profile?.id || '',
    role: profile?.role || 'viewer',
    username: profile?.full_name || profile?.email || '',
    ownerProjectIds: [],
  });

  // Seed presence engine
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

  const [predictions, setPredictions] = useState<any[]>([]);
  const [riskInsightsData, setRiskInsightsData] = useState<any[]>([]);

  useEffect(() => {
    async function fetchRealData() {
      if (!workspace?.id) return;
      const overload = await predictOverload(workspace.id, presence.collaborators, presence.signals, presence.feed);
      const risks = await analyzeExecutionRisks(workspace.id, presence.collaborators, presence.signals, presence.feed, coordination.vitality, coordination.bottlenecks);
      setPredictions(overload);
      setRiskInsightsData(risks);
    }
    fetchRealData();
  }, [workspace?.id, presence.collaborators]);

  const allInsights = useMemo(
    () => [...insights, ...riskInsightsData].sort((a, b) => {
      const order = { critical: 0, warning: 1, notice: 2, info: 3 };
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
    }),
    [insights, riskInsightsData],
  );

  const missionFocus = getMissionFocus(view);
  const focusConfig = getFocusConfig(missionFocus.focusMode);

  const activeCount = useMemo(
    () => presence.collaborators.filter(c => !c.idle).length,
    [presence.collaborators],
  );

  const criticalInsights = allInsights.filter(i => i.severity === 'critical' || i.severity === 'warning').slice(0, 4);
  const otherInsights = allInsights.filter(i => i.severity !== 'critical' && i.severity !== 'warning');

  const isEmpty = raw.projects.length === 0 && raw.tasks.length === 0;

  return (
    <PageShell maxWidth="standard">
      {/* H1 header + active indicators */}
      <PageHeader
        title={isEmpty ? 'Build your execution workspace' : 'Daily Command Center'}
        description={`${activeCount} active contributors | focus: ${missionFocus.label}`}
        actions={
          <div className="flex bg-[var(--color-surface-2)] border border-[var(--color-border)] p-1 rounded-[var(--radius-md)] select-none">
            {(['strategic', 'tactical', 'diagnostic'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={[
                  'px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-[var(--radius-sm)] transition-colors focus:outline-none',
                  view === v
                    ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)]'
                    : 'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                ].join(' ')}
              >
                {v}
              </button>
            ))}
          </div>
        }
      />

      <PageContent>
        {isEmpty ? (
          /* Empty Workspace Welcome Guide */
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center py-[var(--space-10)]">
            <div className="w-12 h-12 rounded-full mb-[var(--space-4)] flex items-center justify-center bg-[var(--color-primary-subtle)] border border-[var(--color-primary)]/20">
              <Rocket size={20} className="text-[var(--color-primary)]" />
            </div>
            <h2 className="text-[var(--text-xl)] font-semibold mb-[var(--space-2)] text-[var(--color-text-primary)]">
              Let's build your workspace.
            </h2>
            <p className="text-[var(--text-base)] text-[var(--color-text-secondary)] max-w-md mb-[var(--space-8)] leading-relaxed">
              Initialize your delivery environment and bring operations online.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-[var(--space-3)] text-[var(--text-xs)] font-mono text-[var(--color-text-muted)] mb-[var(--space-10)] select-none">
              <span className="text-[var(--color-primary)] font-semibold">1. Workspace</span>
              <ChevronRight size={12} />
              <span>2. Projects</span>
              <ChevronRight size={12} />
              <span>3. Milestones</span>
              <ChevronRight size={12} />
              <span>4. Tasks</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-4)] max-w-3xl w-full">
              <Card
                className="flex flex-col items-center gap-[var(--space-3)] p-[var(--space-6)] text-center cursor-pointer hover:border-[var(--color-primary)] transition-colors"
                onClick={() => (window as any).openCreateProjectModal?.()}
              >
                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary-subtle)] border border-[var(--color-primary)]/10 flex items-center justify-center">
                  <KanbanSquare size={18} className="text-[var(--color-primary)]" />
                </div>
                <div>
                  <h3 className="text-[var(--text-base)] font-medium text-[var(--color-text-primary)] mb-1">Create Project</h3>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Initialize delivery</p>
                </div>
              </Card>

              <Card
                className="flex flex-col items-center gap-[var(--space-3)] p-[var(--space-6)] text-center cursor-pointer hover:border-[var(--color-success)] transition-colors"
                onClick={() => navigate('/resources/teams')}
              >
                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-success-subtle)] border border-[var(--color-success)]/10 flex items-center justify-center">
                  <Users size={18} className="text-[var(--color-success)]" />
                </div>
                <div>
                  <h3 className="text-[var(--text-base)] font-medium text-[var(--color-text-primary)] mb-1">Invite Team</h3>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Scale resources</p>
                </div>
              </Card>

              <Card
                className="flex flex-col items-center gap-[var(--space-3)] p-[var(--space-6)] text-center cursor-pointer hover:border-[var(--color-warning)] transition-colors"
                onClick={() => navigate('/control/settings')}
              >
                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-warning-subtle)] border border-[var(--color-warning)]/10 flex items-center justify-center">
                  <Settings size={18} className="text-[var(--color-warning)]" />
                </div>
                <div>
                  <h3 className="text-[var(--text-base)] font-medium text-[var(--color-text-primary)] mb-1">Configure</h3>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Workspace settings</p>
                </div>
              </Card>
            </div>
          </div>
        ) : (
          /* Three-Zone Layout Structure */
          <div className="flex flex-col gap-[var(--space-8)]">
            {/* ZONE 1: What happened? (Attendance / KPI widgets) */}
            <DashboardSection title="Zone 1 — What happened?">
              <WorkSessionPanel />
            </DashboardSection>

            {/* ZONE 2: What requires attention? (Critical / Warning risk items) */}
            <DashboardSection title="Zone 2 — What requires attention?">
              {focusConfig.showPrimary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-[var(--space-4)]">
                  <DashboardWidget title="Execution Pressure" subtitle="Bottlenecks & Hotspots">
                    <ExecutionPressureZones bottlenecks={coordination.bottlenecks} hotspots={coordination.hotspots} vitality={coordination.vitality} />
                  </DashboardWidget>
                  <DashboardWidget title="Attention Focus" subtitle="Direct alerts">
                    <ExecutionPressureZones bottlenecks={coordination.bottlenecks} hotspots={coordination.hotspots} vitality={coordination.vitality} />
                  </DashboardWidget>
                  <DashboardWidget title="Radar Overview" subtitle="Contributor signals">
                    <CoordinationRadar density={coordination.density} signals={presence.signals} />
                  </DashboardWidget>
                </div>
              )}

              {focusConfig.showSecondary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-[var(--space-4)] mt-[var(--space-2)]">
                  <DashboardWidget title="Topology" subtitle="Activity map">
                    <OperationalTopologyMap presences={presence.collaborators} signals={presence.signals} hotspots={coordination.hotspots} />
                  </DashboardWidget>
                  <DashboardWidget title="Organizational Flow" subtitle="Real-time events">
                    <OrganizationalFlowMap presences={presence.collaborators} signals={presence.signals} feed={presence.feed} />
                  </DashboardWidget>
                  <DashboardWidget title="Risk Forecasts" subtitle="Dependency forecast">
                    <DependencyRiskPanel predictions={predictions} insights={allInsights} />
                  </DashboardWidget>
                </div>
              )}
            </DashboardSection>

            {/* ZONE 3: What should I do next? (AI Insight Cards & suggestions) */}
            <DashboardSection title="Zone 3 — What should I do next?">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--space-4)]">
                {focusConfig.showTertiary && criticalInsights.length > 0 && (
                  <DashboardWidget title="Operational Intelligence" subtitle="Critical risk events">
                    <div className="flex flex-col gap-[var(--space-3)]">
                      {criticalInsights.map(insight => (
                        <InsightCard
                          key={insight.id}
                          title={insight.title}
                          description={insight.description}
                        />
                      ))}
                    </div>
                  </DashboardWidget>
                )}

                {focusConfig.showPassive && otherInsights.length > 0 && (
                  <DashboardWidget title="Additional Signals" subtitle="Helper insights">
                    <div className="flex flex-col gap-[var(--space-2)]">
                      {otherInsights.slice(0, 5).map(insight => (
                        <div key={insight.id} className="flex gap-[var(--space-2)] items-center py-[var(--space-1)]">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--color-text-disabled)]" />
                          <p className="text-[var(--text-xs)] font-medium text-[var(--color-text-secondary)] m-0 truncate">
                            {insight.title}
                          </p>
                        </div>
                      ))}
                    </div>
                  </DashboardWidget>
                )}
              </div>
            </DashboardSection>
          </div>
        )}
      </PageContent>
    </PageShell>
  );
}

export default function MissionControlPage() {
  return (
    <DensityProvider surface="mission-control">
      <MissionControlContent />
    </DensityProvider>
  );
}
