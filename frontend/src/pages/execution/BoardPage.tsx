import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import BoardView from '../../components/execution/BoardView';

export default function BoardPage() {
  const { profile } = useAuth();
  const { workspace } = useWorkspace();
  const { projects, profiles, notify, fetchProjects, handlePromoteTaskToAsset } = useDashboard();
  const kanbanProjects = React.useMemo(() => projects.filter((p: any) => p.execution_mode === 'KANBAN'), [projects]);

  return (
    <main className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12">
      <div className="flex justify-between items-center mb-8 bg-[#090a0f]/40 border border-border p-4 rounded-lg backdrop-blur-md">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary">Execution Board</h2>
          <p className="text-[10px] font-mono text-text-tertiary uppercase">Kanban · Scrum · Hybrid workflow execution</p>
        </div>
      </div>
      <BoardView
        projects={kanbanProjects}
        profiles={profiles}
        profile={profile}
        notify={notify}
        onRecalibrateAnalytics={() => fetchProjects()}
        onPromoteToAsset={handlePromoteTaskToAsset}
      />
    </main>
  );
}