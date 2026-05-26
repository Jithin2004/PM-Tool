import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { ExecutionSystem } from '../../components/execution/system/ExecutionSystem';

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

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-8 py-8 h-screen flex flex-col">
      <ExecutionSystem
        projects={[project].filter(Boolean) as any}
        users={profiles}
        currentUserProfile={profile}
        notify={notify}
        onRecalibrateAnalytics={() => fetchProjects()}
      />
    </main>
  );
}
