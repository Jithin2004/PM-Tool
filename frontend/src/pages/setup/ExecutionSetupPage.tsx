import React, { useState, useMemo } from 'react';
import { CheckCircle, ArrowRight, SkipForward, Layers, Users, Calendar, Clock } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { hasCapability } from '../../core/auth/permissions';
import { ScrumBootstrap } from '../../components/setup/ScrumBootstrap';
import { KanbanBootstrap } from '../../components/setup/KanbanBootstrap';
import { SetupSkipState } from '../../components/setup/SetupSkipState';

function getProjectIdFromPath(): string | null {
  const segments = window.location.pathname.split('/');
  if (segments[1] === 'projects' && segments[2]) return segments[2];
  return null;
}

function navigateTo(path: string) {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new CustomEvent('popstate'));
}

type SetupPhase = 'welcome' | 'bootstrap' | 'skip-confirm';

const EXECUTION_MODE_LABELS: Record<string, string> = {
  SCRUM: 'Scrum',
  KANBAN: 'Kanban',
  HYBRID: 'Hybrid (Scrum + Kanban)',
  SDLC: 'Waterfall / SDLC',
  CUSTOM: 'Custom',
};

export default function ExecutionSetupPage() {
  const projectId = getProjectIdFromPath();
  const { projects, notify } = useDashboard();
  const { workspace } = useWorkspace();
  const { profile } = useAuth();

  const project = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);

  const [phase, setPhase] = useState<SetupPhase>('welcome');

  const canInitialize = hasCapability(profile?.role, 'project.update');

  if (!projectId || !project) {
    return (
      <main className="max-w-[1200px] mx-auto px-3 sm:px-6 py-12">
        <div className="text-center py-24">
          <p className="text-xs font-mono uppercase tracking-wide text-text-quaternary">Project not found</p>
        </div>
      </main>
    );
  }

  if (!canInitialize) {
    navigateTo(`/projects/${projectId}/backlog`);
    return null;
  }

  const mode = project.execution_mode || 'KANBAN';
  const isScrumOrHybrid = mode === 'SCRUM' || mode === 'HYBRID';
  const isKanban = mode === 'KANBAN';
  const isWaterfall = mode === 'SDLC' || mode === 'CUSTOM';

  const handleContinue = () => {
    setPhase('bootstrap');
  };

  const handleSkip = () => {
    setPhase('skip-confirm');
  };

  const handleSkipConfirmed = () => {
    notify('Setup skipped. You can configure execution later.', 'info');
    navigateTo(`/projects/${projectId}/backlog`);
  };

  const handleSetupComplete = () => {
    notify('Execution workspace ready.', 'success');
    if (isKanban) {
      navigateTo(`/projects/${projectId}/board`);
    } else {
      navigateTo(`/projects/${projectId}/backlog`);
    }
  };

  const handleSetupSkip = () => {
    if (isKanban) {
      navigateTo(`/projects/${projectId}/board`);
    } else {
      navigateTo(`/projects/${projectId}/backlog`);
    }
  };

  const modeLabel = EXECUTION_MODE_LABELS[mode] || mode;

  return (
    <main className="max-w-[1200px] mx-auto px-3 sm:px-6 py-6 sm:py-12">
      <div className="max-w-2xl mx-auto">
        {phase === 'welcome' && (
          <div className="space-y-8">
            <div className="flex items-center gap-4 pb-6 border-b border-border">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="h-7 w-7 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-lg font-sans tracking-tight uppercase tracking-wide text-text-primary">Project Created Successfully</h1>
                <p className="text-xs text-text-quaternary mt-1">Let's prepare your execution workspace.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border border-border rounded-lg bg-surface-3">
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4 text-text-quaternary" />
                  <span className="text-[9px] font-mono uppercase tracking-wider text-text-quaternary">Project</span>
                </div>
                <p className="text-sm text-text-secondary font-medium">{project.name}</p>
              </div>
              <div className="p-4 border border-border rounded-lg bg-surface-3">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-text-quaternary" />
                  <span className="text-[9px] font-mono uppercase tracking-wider text-text-quaternary">Mode</span>
                </div>
                <p className="text-sm text-text-secondary font-medium">{modeLabel}</p>
              </div>
              <div className="p-4 border border-border rounded-lg bg-surface-3">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-text-quaternary" />
                  <span className="text-[9px] font-mono uppercase tracking-wider text-text-quaternary">Team</span>
                </div>
                <p className="text-sm text-text-secondary font-medium">{project.team_id ? 'Assigned' : 'Not assigned'}</p>
              </div>
              <div className="p-4 border border-border rounded-lg bg-surface-3">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-text-quaternary" />
                  <span className="text-[9px] font-mono uppercase tracking-wider text-text-quaternary">Deadline</span>
                </div>
                <p className="text-sm text-text-secondary font-medium">
                  {project.deadline ? new Date(project.deadline).toLocaleDateString() : 'Not set'}
                </p>
              </div>
            </div>

            {isWaterfall && (
              <div className="p-4 border border-border rounded-lg bg-signal-warning-bg border-border">
                <p className="text-[11px] text-signal-warning/80 font-mono">
                  Waterfall projects use timeline-based phase tracking. Redirecting to timeline setup...
                </p>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleContinue}
                className="px-6 py-2.5 bg-accent-primary text-[var(--pm-text)] text-[var(--text-primary)] text-[10px] font-medium uppercase tracking-wider hover:bg-accent-primary/90 transition-all rounded-sm shadow-sm flex items-center gap-2 cursor-pointer"
              >
                Continue Setup <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleSkip}
                className="flex items-center gap-1.5 px-4 py-2.5 text-text-quaternary text-[10px] font-medium uppercase tracking-wider hover:text-text-tertiary transition-all cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5" /> Skip For Now
              </button>
            </div>
          </div>
        )}

        {phase === 'bootstrap' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-border">
              <button onClick={() => setPhase('welcome')} className="text-[10px] font-mono text-text-quaternary hover:text-text-tertiary transition-colors uppercase tracking-wider">
                Back
              </button>
              <span className="text-text-quaternary">/</span>
              <span className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">Setup</span>
            </div>

            {isScrumOrHybrid && (
              <ScrumBootstrap
                projectId={projectId}
                workspaceId={workspace?.id || ''}
                onComplete={handleSetupComplete}
                onSkip={handleSetupSkip}
              />
            )}

            {isKanban && (
              <KanbanBootstrap
                projectId={projectId}
                workspaceId={workspace?.id || ''}
                onComplete={handleSetupComplete}
                onSkip={handleSetupSkip}
              />
            )}

            {isWaterfall && (
              <div className="text-center py-12">
                <p className="text-xs font-mono text-text-quaternary">Redirecting to timeline setup...</p>
              </div>
            )}
          </div>
        )}

        {phase === 'skip-confirm' && (
          <SetupSkipState
            projectName={project.name}
            onSkip={handleSkipConfirmed}
            onCancel={() => setPhase('bootstrap')}
          />
        )}
      </div>
    </main>
  );
}

