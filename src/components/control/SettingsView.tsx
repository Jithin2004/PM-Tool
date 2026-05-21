import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { AdminDashboard } from '../admin/AdminDashboard';

const SettingsView = React.memo(function SettingsView() {
  const { profile } = useAuth();
  const { profiles, teams, systemData, handleSaveLogisticsData, askConfirmation,
    handleUpdateRole, handleCreateTeam, handleUpdateTeam, handleDeleteTeam } = useDashboard();

  if (profile?.role !== 'super_admin') {
    return <div className="flex-1 flex items-center justify-center text-white/50 font-mono text-sm uppercase">Unauthorized</div>;
  }

  const activeTeams = teams.filter((t: any) => t.name !== 'SYSTEM_SETTINGS');

  return (
    <AdminDashboard
      profiles={profiles}
      teams={activeTeams}
      currentUserRole={profile?.role}
      systemData={systemData}
      onSaveSystemData={handleSaveLogisticsData}
      askConfirmation={askConfirmation}
      onUpdateRole={handleUpdateRole}
      onCreateTeam={handleCreateTeam}
      onUpdateTeam={handleUpdateTeam}
      onDeleteTeam={handleDeleteTeam}
    />
  );
});

export default SettingsView;