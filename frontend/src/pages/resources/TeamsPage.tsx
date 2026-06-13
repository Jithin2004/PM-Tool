import { PremiumEmptyState } from '../../components/ui/PremiumEmptyState';
import React, { useState, useEffect } from 'react';
import { TeamRosterView } from '../../components/resources/TeamRosterView';
import { SkillsMatrixView } from '../../components/resources/SkillsMatrixView';
import { DepartmentManagement } from '../../components/team/DepartmentManagement';
import { MemberDirectory } from '../../components/team/MemberDirectory';
import { useAuth } from '../../context/AuthContext';
import { hasCapability } from '../../core/auth/permissions';

export default function TeamsPage() {
  const { profile } = useAuth();
  const isHR = hasCapability(profile?.role, 'manage_employees');
  
  const [activeTab, setActiveTab] = useState<'employees' | 'departments' | 'workloadPlanning' | 'skillsMatrix'>(() => {
    const path = window.location.pathname;
    if (path === '/resources/capacity') return 'workloadPlanning';
    if (path === '/resources/teams/departments') return 'departments';
    if (path === '/resources/teams/skills') return 'skillsMatrix';
    return 'employees';
  });

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/resources/capacity') setActiveTab('workloadPlanning');
      else if (path === '/resources/teams/departments') setActiveTab('departments');
      else if (path === '/resources/teams/skills') setActiveTab('skillsMatrix');
      else setActiveTab('employees');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  
  const TEAM_VIEWS = {
    employees: (
      <div className="glass-panel rounded-xl border border-border overflow-hidden bg-surface-2">
        <MemberDirectory />
      </div>
    ),
    departments: (
      <div className="glass-panel rounded-xl border border-border overflow-hidden bg-surface-2">
        <DepartmentManagement />
      </div>
    ),
    workloadPlanning: (
      <div className="glass-panel rounded-xl border border-border overflow-hidden bg-surface-2">
        <TeamRosterView />
      </div>
    ),
    skillsMatrix: (
      <div className="glass-panel rounded-xl border border-border overflow-hidden bg-surface-2">
        <SkillsMatrixView />
      </div>
    )
  };

  return (
    <div className="space-y-8 pb-16 font-geist text-[var(--pm-primary)]" style={{ color: 'var(--pm-on-surface)' }}>
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--pm-on-surface)' }}>
            Team Management
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Manage employees, departments, skills, and workload.
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-border bg-surface-2"
          style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 operational-pulse" style={{ boxShadow: '0 0 8px rgba(251,191,36,0.5)' }} />
          <span className="font-mono-pm text-xs uppercase tracking-widest text-[var(--pm-on-surface-variant)]" style={{ color: 'var(--pm-on-surface-variant)' }}>
             TEAM OVERVIEW
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 mt-8">
        {TEAM_VIEWS[activeTab]}
      </div>
    </div>
  );
}
