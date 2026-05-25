import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { LogisticsDashboard } from '../../components/admin/LogisticsDashboard';

export function LogisticsPanel() {
  const { profile } = useAuth();
  const { 
    profiles, 
    teams, 
    projects,
    tasks,
    updateTask,
    systemData,
    handleSaveLogisticsData 
  } = useDashboard();

  if (profile?.role !== 'super_admin' && profile?.role !== 'pm') {
    return (
      <div className="flex-1 flex items-center justify-center text-text-tertiary font-mono text-sm uppercase">
        Unauthorized: Admin Access Required
      </div>
    );
  }

  return (
    <LogisticsDashboard
      profiles={profiles}
      teams={teams}
      projects={projects}
      tasks={tasks}
      updateTask={updateTask}
      systemData={systemData}
      onSaveData={handleSaveLogisticsData}
      role={profile?.role}
    />
  );
}
