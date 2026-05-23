import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import BoardView from '../../components/execution/BoardView';

function getProjectIdFromPath(): string | null {
  const segments = window.location.pathname.split('/');
  if (segments[1] === 'projects' && segments[2]) return segments[2];
  return null;
}

export default function ProjectBoardPage() {
  const projectId = getProjectIdFromPath();
  const { profile } = useAuth();
  const { projects, profiles, notify, handlePromoteTaskToAsset } = useDashboard();
  const project = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);

  return (
    <main className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12">
      <div className="flex justify-between items-center mb-8 bg-[#090a0f]/40 border border-white/10 p-4 rounded-lg backdrop-blur-md">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">{project?.name || 'Project'} — Board</h2>
          <p className="text-[10px] font-mono text-white/50 uppercase">Task execution board</p>
        </div>
      </div>
      <BoardView
        projects={[project].filter(Boolean)}
        profiles={profiles}
        profile={profile}
        notify={notify}
        onRecalibrateAnalytics={() => {}}
        onPromoteToAsset={handlePromoteTaskToAsset}
      />
    </main>
  );
}
