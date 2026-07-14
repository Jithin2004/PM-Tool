import { EmptyState } from '../../components/core';
import React, { useState, useEffect } from 'react';
import { TeamRosterView } from '../../components/resources/TeamRosterView';
import { SkillsMatrixView } from '../../components/resources/SkillsMatrixView';
import { DepartmentManagement } from '../../components/team/DepartmentManagement';
import { MemberDirectory } from '../../components/team/MemberDirectory';
import { useAuth } from '../../context/AuthContext';
import { hasCapability } from '../../core/auth/permissions';
import { useOperationalData } from '../../context/OperationalDataContext';
import { Users } from 'lucide-react';
import { navigate } from '../../lib/navigation';


export default function TeamsPage() {
  const { profile } = useAuth();
  const { raw } = useOperationalData();
  const isHR = hasCapability(profile?.role, 'people.manage');
  
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

  

  const onboardedMembersCount = raw.profiles.filter(p => 
    p.id !== profile?.id && 
    p.role !== 'uninvited' && 
    (!p.employment_status || ['active', 'on_leave', 'suspended'].includes(p.employment_status)) &&
    (p as any).status !== 'archived'
  ).length;
  
  const TEAM_VIEWS = {
    employees: (
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl border border-border overflow-hidden bg-surface-2">
        <MemberDirectory />
      </div>
    ),
    departments: (
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl border border-border overflow-hidden bg-surface-2">
        <DepartmentManagement />
      </div>
    ),
    workloadPlanning: (
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl border border-border overflow-hidden bg-surface-2">
        <TeamRosterView />
      </div>
    ),
    skillsMatrix: (
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl border border-border overflow-hidden bg-surface-2">
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
        {onboardedMembersCount === 0 ? (
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl border border-border overflow-hidden bg-surface-2 p-8">
             <EmptyState
               icon={Users}
               title="Build Your Team"
               description="No employees have joined this workspace yet. Invite your first team member to unlock Team Directory, Capacity Planning, Skills Matrix and Workload Analytics."
               action={
                 <button onClick={() => navigate('/admin/identity')} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors">
                   Invite Teammates
                 </button>
               }
             />
          </div>
        ) : (
          TEAM_VIEWS[activeTab]
        )}
      </div>
    </div>
  );
}



