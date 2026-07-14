import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { ExecutionSystem } from '../../components/execution/system/ExecutionSystem';

import { PageShell, PageHeader, PageContent } from '../../components/core';

function getProjectIdFromPath(): string | null {
  const segments = window.location.pathname.split('/');
  if (segments[1] === 'projects' && segments[2]) return segments[2];
  return null;
}

export default function ProjectSprintPage() {
  const projectId = getProjectIdFromPath();
  const { profile } = useAuth();
  const { projects, profiles, notify, fetchProjects } = useDashboard();
  const project = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);

  return (
    <PageShell maxWidth="full" className="px-6 py-6 h-screen flex flex-col">
      <PageHeader
        title={project ? `${project.name} Sprints` : 'Sprint Board'}
        overline="Project Sprints & Cadences"
        description="Time-boxed scrum planning and active sprint velocity logs."
      />
      <PageContent className="flex-1 min-h-0">
        <ExecutionSystem
          projects={[project].filter(Boolean) as any}
          users={profiles}
          currentUserProfile={profile}
          notify={notify}
          onRecalibrateAnalytics={() => fetchProjects()}
          initialView="sprint"
        />
      </PageContent>
    </PageShell>
  );
}
