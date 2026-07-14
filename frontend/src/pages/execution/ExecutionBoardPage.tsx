import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { ExecutionSystem } from '../../components/execution/system/ExecutionSystem';
import { Icon } from '../../components/ui/Icon';

import { PageShell, PageHeader, PageContent, Button } from '../../components/core';
import { FolderOpen } from 'lucide-react';

function getProjectIdFromPath(): string | null {
  const segments = window.location.pathname.split('/');
  if (segments[1] === 'projects' && segments[2]) return segments[2];
  return null;
}

export default function ExecutionBoardPage() {
  const { profile } = useAuth();
  const { projects, profiles, notify, fetchProjects, sprints } = useDashboard();
  const { raw: { tasks } } = useOperationalData();
  
  const projectId = getProjectIdFromPath();
  const activeSprint = sprints?.find(s => s.status === 'active');
  
  const isGlobal = !projectId;
  const project = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);

  const projectTasks = useMemo(() => {
    if (isGlobal) return [];
    return tasks.filter((t: any) => t.project_id === projectId);
  }, [tasks, projectId, isGlobal]);

  const hasMissingSetup = !isGlobal && project && (!project.deadline || !project.owner_id || projectTasks.length === 0);

  // Determine which projects to pass to ExecutionSystem
  const targetProjects = isGlobal ? projects : ([project].filter(Boolean) as any);

  return (
    <PageShell maxWidth={isGlobal ? 'full' : 'full'} className="h-full px-6 py-6 flex flex-col">
      <PageHeader
        title={isGlobal ? 'Execution Engine' : (project?.name || 'Execution Board')}
        overline={isGlobal ? 'Enterprise Execution Tracking' : 'Project Sprints & Tasks'}
        description={isGlobal ? 'Kanban execution tracking and task assignments.' : 'Interactive delivery lifecycle tracking.'}
        actions={
          <div className="flex items-center gap-3">
            {!isGlobal && project?.id && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                <FolderOpen size={14} className="text-[var(--color-primary)]" />
                <span className="font-mono text-[11px] font-semibold text-[var(--color-text-secondary)]">
                  {`PRJ-${project.id.slice(0, 8).toUpperCase()}`}
                </span>
              </div>
            )}
            {activeSprint && (
              <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] operational-pulse" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)]">
                  ACTIVE SPRINT
                </span>
              </div>
            )}
          </div>
        }
      />

      <PageContent className="flex-1 min-h-0 flex flex-col gap-6">
        {hasMissingSetup && (
          <div className="p-5 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5">
            <h2 className="text-lg font-bold text-[var(--color-warning)] mb-2">Project Setup Incomplete</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Your project is missing information required for forecasting. Without this data, the Decision Intelligence Engine cannot simulate delivery risks or track execution health.
            </p>
            <div className="flex gap-4">
              {!project?.deadline && (
                <Button variant="secondary" size="sm">
                  + Add Deadline
                </Button>
              )}
              {!project?.owner_id && (
                <Button variant="secondary" size="sm">
                  + Assign Owner
                </Button>
              )}
              {projectTasks.length === 0 && (
                <Button variant="secondary" size="sm">
                  + Create Milestones
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <ExecutionSystem
            projects={targetProjects}
            users={profiles}
            currentUserProfile={profile}
            notify={notify}
            onRecalibrateAnalytics={() => fetchProjects()}
          />
        </div>
      </PageContent>
    </PageShell>
  );
}
