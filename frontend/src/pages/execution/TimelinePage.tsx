import React from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { useTasks } from '../../hooks/useTasks';
import { useWorkspace } from '../../context/WorkspaceContext';
import { TimelineView } from '../../components/execution/TimelineView';

export default function TimelinePage() {
  const { projects, profiles } = useDashboard();
  const { workspace } = useWorkspace();
  const { tasks, dependencies } = useTasks(workspace?.id);

  return (
    <main className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12">
      <TimelineView
        projects={projects}
        tasks={tasks}
        dependencies={dependencies}
        profiles={profiles}
      />
    </main>
  );
}
