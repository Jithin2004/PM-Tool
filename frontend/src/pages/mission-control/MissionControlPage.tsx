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
import { OnboardingChecklist } from '../../components/onboarding/OnboardingChecklist';
import { hasAuthority, hasFunction, hasCapability } from '../../core/auth/permissions';
import { KanbanSquare, Users, Building2, Settings, Target, ListTodo, Calendar, Banknote, BarChart3, Play, MessageSquare, Rocket, ChevronRight } from 'lucide-react';

function MissionControlContent() {
  const { profile } = useAuth();
  const { workspace } = useWorkspace();
  const { raw } = useOperationalData();
  const [view, setView] = useState<MissionControlView>('strategic');

  const navigateTo = (path: string) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new CustomEvent('popstate'));
  };

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
    <div className="space-y-8 pb-16 font-geist text-[var(--pm-primary)] max-w-7xl mx-auto px-4" style={{ color: 'var(--pm-on-surface)' }}>
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2 pb-8 mb-10 border-b border-border/50">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--pm-on-surface)' }}>
            {(raw.projects.length === 0 && raw.tasks.length === 0) ? 'Build your execution workspace' : 'Daily Command Center'}
          </h1>
          <p className="text-sm mt-1 flex items-center gap-3" style={{ color: 'var(--pm-on-surface-variant)' }}>
             <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse" /> {activeCount} active contributors</span>
             <span className="text-border">|</span>
             <span className="uppercase tracking-widest text-[10px] font-bold text-[var(--pm-on-surface-variant)]">{missionFocus.label}</span>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex bg-surface-3 border border-border p-1 rounded-xl">
            {(['strategic', 'tactical', 'diagnostic'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-5 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all duration-300 ${
                  view === v 
                    ? 'bg-[var(--pm-primary)] text-[var(--pm-on-primary)] shadow-lg scale-100' 
                    : 'bg-transparent text-[var(--pm-on-surface-variant)] hover:text-[var(--pm-on-surface)] scale-95'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>



      {(raw.projects.length === 0 && raw.tasks.length === 0) ? (
        (() => {
          return (
            <div className="flex flex-col items-center justify-center min-h-[500px] text-center px-4 py-8">
              <div className="w-16 h-16 rounded-full mb-6 flex items-center justify-center bg-indigo-500/10">
                <Rocket className="w-8 h-8 text-indigo-400" />
              </div>
              <h2 className="text-3xl font-bold mb-3 tracking-tight text-white font-geist">Let's start building your workspace</h2>
              <p className="text-base max-w-lg mx-auto leading-relaxed text-[var(--text-secondary)] mb-12 font-geist">
                Follow the guided journey to initialize your delivery environment and bring your operations online.
              </p>
              
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-sm font-mono text-[var(--text-secondary)] mb-12">
                <div className="flex items-center gap-2 text-indigo-400">
                  <div className="w-8 h-8 rounded-full border border-indigo-500/30 flex items-center justify-center bg-indigo-500/10">1</div>
                  <span className="font-semibold">Workspace</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--border-soft)]" />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center bg-surface-3">2</div>
                  <span>Projects</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--border-soft)] hidden sm:block" />
                <div className="flex items-center gap-2 hidden sm:flex">
                  <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center bg-surface-3">3</div>
                  <span>Milestones</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--border-soft)] hidden md:block" />
                <div className="flex items-center gap-2 hidden md:flex">
                  <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center bg-surface-3">4</div>
                  <span>Tasks</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--border-soft)] hidden lg:block" />
                <div className="flex items-center gap-2 hidden lg:flex">
                  <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center bg-surface-3">5</div>
                  <span>Delivery Tracking</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto w-full">
                <button 
                  onClick={() => (window as any).openCreateProjectModal?.()}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors text-center group"
                >
                  <KanbanSquare className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-semibold text-white">Create first project</span>
                </button>
                <button 
                  onClick={() => navigateTo('/resources/teams')}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 transition-colors text-center group"
                >
                  <Users className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-semibold text-white">Invite teammates</span>
                </button>
                <button 
                  onClick={() => navigateTo('/control/settings')}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 transition-colors text-center group"
                >
                  <Settings className="w-6 h-6 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-semibold text-white">Configure workspace</span>
                </button>
              </div>
            </div>
          );
        })()
      ) : (
        <>


      {focusConfig.showPrimary && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          <div className="relative group p-6 glass-panel rounded-xl bg-surface-2 border border-border overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
            <div className="relative z-10"><ExecutionPressureZones bottlenecks={coordination.bottlenecks} hotspots={coordination.hotspots} vitality={coordination.vitality} /></div>
          </div>
          <div className="relative group p-6 glass-panel rounded-xl bg-surface-2 border border-border overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
            <div className="relative z-10"><ExecutionPressureZones bottlenecks={coordination.bottlenecks} hotspots={coordination.hotspots} vitality={coordination.vitality} /></div>
          </div>
          <div className="relative group p-6 glass-panel rounded-xl bg-surface-2 border border-border overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
            <div className="relative z-10"><CoordinationRadar density={coordination.density} signals={presence.signals} /></div>
          </div>
        </div>
      )}

      {focusConfig.showSecondary && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          <div className="relative group p-6 glass-panel rounded-xl bg-surface-2 border border-border overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
            <div className="relative z-10"><OperationalTopologyMap presences={presence.collaborators} signals={presence.signals} hotspots={coordination.hotspots} /></div>
          </div>
          <div className="relative group p-6 glass-panel rounded-xl bg-surface-2 border border-border overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
            <div className="relative z-10"><OrganizationalFlowMap presences={presence.collaborators} signals={presence.signals} feed={presence.feed} /></div>
          </div>
          <div className="relative group p-6 glass-panel rounded-xl bg-surface-2 border border-border overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
            <div className="relative z-10"><DependencyRiskPanel predictions={predictions} insights={allInsights} /></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {focusConfig.showTertiary && criticalInsights.length > 0 && (
          <div className="relative group p-6 glass-panel rounded-xl bg-surface-2 border border-border overflow-hidden h-full">
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
          <div className="relative group p-6 glass-panel rounded-xl bg-surface-2 border border-border overflow-hidden h-full">
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
      </>
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
