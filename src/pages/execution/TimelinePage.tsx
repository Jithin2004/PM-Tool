import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import TimelineView from '../../components/execution/TimelineView';

export default function TimelinePage() {
  const { profile } = useAuth();
  const { projects, profiles, notify, fetchProjects, handlePromoteTaskToAsset } = useDashboard();
  const kanbanProjects = React.useMemo(() => projects.filter((p: any) => p.execution_mode === 'KANBAN'), [projects]);

  return (
    <main className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12">
      <div className="flex justify-between items-center mb-8 bg-[#090a0f]/40 border border-white/10 p-4 rounded-lg backdrop-blur-md">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Timeline Engine</h2>
          <p className="text-[10px] font-mono text-white/50 uppercase">Dependency propagation and scheduling intelligence</p>
        </div>
      </div>
      <TimelineView
        kanbanProjects={kanbanProjects}
        profiles={profiles}
        profile={profile}
        notify={notify}
        onRecalibrateAnalytics={() => fetchProjects()}
        onPromoteToAsset={handlePromoteTaskToAsset}
      />
    </main>
  );
}