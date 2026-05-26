import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { ExecutionSystem } from '../../components/execution/system/ExecutionSystem';

export default function GanttPage() {
  const { profile } = useAuth();
  const { projects, profiles, notify, fetchProjects } = useDashboard();

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-8 py-8 h-screen flex flex-col">
      <ExecutionSystem
        projects={projects}
        users={profiles}
        currentUserProfile={profile}
        notify={notify}
        onRecalibrateAnalytics={() => fetchProjects()}
        initialView="timeline"
      />
    </main>
  );
}
