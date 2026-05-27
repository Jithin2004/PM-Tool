import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { LogisticsDashboard } from '../../components/admin/LogisticsDashboard';
import { hasCapability } from '../../core/auth/permissions';
import { Icon } from '../../components/ui/Icon';

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

  if (!hasCapability(profile?.role, 'manage_logistics')) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 font-geist"
        style={{ color: 'var(--pm-on-surface-variant)' }}>
        <Icon name="lock" size={40} style={{ opacity: 0.3 }} />
        <div className="text-center">
          <p className="font-mono-pm text-[11px] uppercase tracking-widest mb-1" style={{ color: 'var(--pm-error)' }}>
            CLEARANCE DENIED
          </p>
          <p className="text-sm">Logistics management privileges required to access this module.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 font-geist" style={{ color: 'var(--pm-on-surface)' }}>
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operational Logistics</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Resource management, attendance tracking, and capacity planning.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(255,183,131,0.08)', border: '1px solid rgba(255,183,131,0.2)' }}>
          <Icon name="local_shipping" size={16} style={{ color: 'var(--pm-tertiary)' }} />
          <span className="font-mono-pm text-[10px] uppercase tracking-widest" style={{ color: 'var(--pm-tertiary)' }}>
            Logistics Module
          </span>
        </div>
      </div>

      {/* Logistics Dashboard */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(70,69,84,0.3)' }}>
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
      </div>
    </div>
  );
}
