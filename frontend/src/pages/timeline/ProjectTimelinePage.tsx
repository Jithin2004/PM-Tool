import React, { useMemo } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { useTasks } from '../../hooks/useTasks';
import { useWorkspace } from '../../context/WorkspaceContext';
import { TimelineView } from '../../components/execution/TimelineView';

function getProjectIdFromPath(): string | null {
  const segments = window.location.pathname.split('/');
  if (segments[1] === 'projects' && segments[2]) return segments[2];
  return null;
}

export default function ProjectTimelinePage() {
  const projectId = getProjectIdFromPath();
  const { projects, profiles } = useDashboard();
  const { workspace } = useWorkspace();
  const { tasks, dependencies } = useTasks(workspace?.id);
  const project = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);

  return (
    <main className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12">
      <div className="flex justify-between items-center mb-8 bg-[#090a0f]/40 border border-border p-4 rounded-lg backdrop-blur-md">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary">{project?.name || 'Project'} — Timeline</h2>
          <p className="text-[10px] font-mono text-text-tertiary uppercase">Phase tracking · milestones · critical path</p>
        </div>
      </div>
      <TimelineView
        projects={[project].filter(Boolean)}
        tasks={tasks}
        dependencies={dependencies}
        profiles={profiles}
      />
    </main>
  );
}
