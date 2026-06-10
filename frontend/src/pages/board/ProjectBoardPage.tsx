import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { ExecutionSystem } from '../../components/execution/system/ExecutionSystem';
import { Icon } from '../../components/ui/Icon';
import { useOperationalData } from '../../context/OperationalDataContext';

function getProjectIdFromPath(): string | null {
  const segments = window.location.pathname.split('/');
  if (segments[1] === 'projects' && segments[2]) return segments[2];
  return null;
}

export default function ProjectBoardPage() {
  const projectId = getProjectIdFromPath();
  const { profile } = useAuth();
  const { projects, profiles, notify, fetchProjects } = useDashboard();
  const project = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);

  const { raw: { tasks } } = useOperationalData();

  const projectTasks = useMemo(() => {
    return tasks.filter((t: any) => t.project_id === projectId);
  }, [tasks, projectId]);

  const hasMissingSetup = project && (!project.deadline || !project.owner_id || projectTasks.length === 0);

  return (
    <div className="h-full flex flex-col font-geist" style={{ color: 'var(--pm-on-surface)' }}>

      {/* Board Header */}
      <div className="flex items-center justify-between px-1 py-3 mb-4 border-b shrink-0"
        style={{ borderColor: 'rgba(70,69,84,0.3)' }}>
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold tracking-tight">
            {project?.name || 'Execution Board'}
          </h1>
          <div className="h-5 w-px" style={{ background: 'rgba(70,69,84,0.5)' }} />
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg"
            style={{ background: 'var(--pm-surface-low)', border: '1px solid rgba(70,69,84,0.3)' }}>
            <Icon name="folder_open" size={14} style={{ color: 'var(--pm-primary)' }} />
            <span className="font-mono-pm text-[11px]" style={{ color: 'var(--pm-on-surface-variant)' }}>
              {project?.id ? `PRJ-${project.id.slice(0, 8).toUpperCase()}` : 'SELECT PROJECT'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status badge */}
          {project && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
              style={{ background: 'rgba(192,193,255,0.08)', border: '1px solid rgba(192,193,255,0.15)' }}>
              <span className="w-1.5 h-1.5 rounded-full operational-pulse"
                style={{ background: 'var(--pm-primary)', boxShadow: '0 0 6px rgba(192,193,255,0.5)' }} />
              <span className="font-mono-pm text-[10px] uppercase tracking-widest" style={{ color: 'var(--pm-primary)' }}>
                {project.status?.replace('_', ' ') || 'Active'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Execution System fills remaining height */}
      <div className="flex-1 min-h-0">
        {hasMissingSetup && (
          <div className="mx-4 mb-6 p-5 rounded-xl border border-amber-500/30 bg-amber-500/5">
            <h2 className="text-lg font-bold text-amber-400 mb-2">Project Setup Incomplete</h2>
            <p className="text-sm text-[var(--pm-on-surface-variant)] mb-4">
              Your project is missing information required for forecasting. Without this data, the Decision Intelligence Engine cannot simulate delivery risks or track execution health.
            </p>
            <div className="flex gap-4">
              {!project?.deadline && (
                <button className="text-sm px-4 py-2 bg-surface-3 rounded hover:bg-surface-high border border-border transition-colors">
                  + Add Deadline
                </button>
              )}
              {!project?.owner_id && (
                <button className="text-sm px-4 py-2 bg-surface-3 rounded hover:bg-surface-high border border-border transition-colors">
                  + Assign Owner
                </button>
              )}
              {projectTasks.length === 0 && (
                <button className="text-sm px-4 py-2 bg-surface-3 rounded hover:bg-surface-high border border-border transition-colors">
                  + Create Milestones
                </button>
              )}
            </div>
          </div>
        )}

        <ExecutionSystem
          projects={[project].filter(Boolean) as any}
          users={profiles}
          currentUserProfile={profile}
          notify={notify}
          onRecalibrateAnalytics={() => fetchProjects()}
        />
      </div>
    </div>
  );
}
