import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { LogisticsDashboard } from '../admin/LogisticsDashboard';

const CapacityView = React.memo(function CapacityView() {
  const { profile } = useAuth();
  const { profiles, teams, systemData, handleSaveLogisticsData } = useDashboard();

  if (profile?.role !== 'super_admin' && profile?.role !== 'pm') {
    return <div className="flex-1 flex items-center justify-center text-white/50 font-mono text-sm uppercase">Unauthorized</div>;
  }

  return (
    <LogisticsDashboard
      profiles={profiles}
      teams={teams}
      systemData={systemData}
      onSaveData={handleSaveLogisticsData}
      role={profile?.role}
      defaultTab="payroll"
      hideTabs={true}
    />
  );
});

export default CapacityView;