import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { ExecutionSystem } from '../../components/execution/system/ExecutionSystem';

export default function BoardPage() {
  const { profile } = useAuth();
  const { projects, profiles, notify, fetchProjects, handlePromoteTaskToAsset } = useDashboard();

  return (
    <div className="space-y-8 pb-16 font-geist text-[var(--pm-primary)]" style={{ color: 'var(--pm-on-surface)' }}>
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--pm-on-surface)' }}>
            Execution Board
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Kanban execution tracking and task assignments.
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-border bg-surface-2"
          style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 operational-pulse" style={{ boxShadow: '0 0 8px rgba(52,211,153,0.5)' }} />
          <span className="font-mono-pm text-xs uppercase tracking-widest text-[var(--pm-on-surface-variant)]" style={{ color: 'var(--pm-on-surface-variant)' }}>
             ACTIVE SPRINT
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-12 glass-panel rounded-xl border border-border h-[calc(100vh-180px)] overflow-hidden bg-surface-2">
          <ExecutionSystem
            projects={projects}
            users={profiles}
            currentUserProfile={profile}
            notify={notify}
            onRecalibrateAnalytics={() => fetchProjects()}
            
          />
        </div>
      </div>
    </div>
  );
}
