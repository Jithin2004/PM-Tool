import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { AdminDashboard } from '../../components/admin/AdminDashboard';
import { CalendarIntelligencePanel } from '../../components/admin/CalendarIntelligencePanel';

export function AdminPanel() {
  const { profile } = useAuth();
  const { 
    profiles, 
    teams, 
    systemData,
    handleSaveLogisticsData,
    askConfirmation,
    handleUpdateRole, 
    handleCreateTeam, 
    handleUpdateTeam, 
    handleDeleteTeam 
  } = useDashboard();
  const [tab, setTab] = useState<'identity' | 'calendar'>('identity');
  const canViewCalendar = profile?.role === 'super_admin';

  if (profile?.role !== 'super_admin' && profile?.role !== 'pm') {
    return (
      <div className="flex-1 flex items-center justify-center text-white/50 font-mono text-sm uppercase">
        Unauthorized: Admin Access Required
      </div>
    );
  }

  const activeTeams = teams.filter(t => t.name !== 'SYSTEM_SETTINGS');

  return (
    <div>
      <div className="flex gap-1 px-3 sm:px-6 pt-6 border-b border-white/10">
        <button
          onClick={() => setTab('identity')}
          className={`px-4 py-2 text-xs font-mono uppercase tracking-widest transition-colors ${
            tab === 'identity' ? 'border-b-2 border-white text-white' : 'text-white/50 hover:text-white/80'
          }`}
        >
          Identity & Teams
        </button>
        {canViewCalendar && (
          <button
            onClick={() => setTab('calendar')}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-widest transition-colors ${
              tab === 'calendar' ? 'border-b-2 border-white text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            Calendar Intelligence
          </button>
        )}
      </div>
      <div className="pt-0">
        {tab === 'identity' && (
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
        )}
        {tab === 'calendar' && (
          <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12">
            <CalendarIntelligencePanel />
          </div>
        )}
      </div>
    </div>
  );
}
