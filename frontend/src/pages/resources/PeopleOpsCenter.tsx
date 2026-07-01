import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { hasCapability } from '../../core/auth/permissions';
import { MemberDirectory } from '../../components/team/MemberDirectory';
import { DepartmentManagement } from '../../components/team/DepartmentManagement';
import { SkillsMatrixView } from '../../components/resources/SkillsMatrixView';
import { LogisticsDashboard } from '../../components/admin/LogisticsDashboard';
import { Users, Building, ShieldCheck, Clock, CalendarRange, Map, Briefcase } from 'lucide-react';

export default function PeopleOpsCenter() {
  const { profile } = useAuth();
  const { profiles, teams, projects, tasks, updateTask, systemData, handleSaveLogisticsData } = useDashboard();
  const canManageHR = hasCapability(profile?.role, 'people.manage');
  
  const [activeTab, setActiveTab] = useState<'employees' | 'departments' | 'skills' | 'attendance' | 'leave'>('employees');

  if (!canManageHR) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center max-w-md">
          <ShieldCheck className="w-12 h-12 text-[var(--pm-primary)] mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
          <p className="text-[var(--text-secondary)]">You do not have the required permissions to access People Operations.</p>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'departments', label: 'Departments', icon: Building },
    { id: 'skills', label: 'Skills Matrix', icon: Map },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'leave', label: 'Leave & Payroll', icon: CalendarRange }
  ] as const;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-surface">
      <div className="flex-shrink-0 p-6 md:p-8 border-b border-border bg-surface-2/30">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
              People Ops Center
            </h1>
            <p className="text-[var(--text-secondary)] text-sm max-w-2xl leading-relaxed">
              Centralized workspace for employee management, departments, and operations.
            </p>
          </div>
          <div className="flex bg-surface-2 p-1 rounded-lg border border-border overflow-x-auto">
            {TABS.map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-500 text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-white hover:bg-surface-3'}`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 h-full">
          {activeTab === 'employees' && <MemberDirectory />}
          {activeTab === 'departments' && <DepartmentManagement />}
          {activeTab === 'skills' && <SkillsMatrixView />}
          {activeTab === 'attendance' && (
            <LogisticsDashboard
              profiles={profiles}
              teams={teams}
              projects={projects}
              tasks={tasks}
              updateTask={updateTask}
              systemData={systemData}
              onSaveData={handleSaveLogisticsData}
              role={profile?.role}
              defaultTab="attendance"
            />
          )}
          {activeTab === 'leave' && (
            <LogisticsDashboard
              profiles={profiles}
              teams={teams}
              projects={projects}
              tasks={tasks}
              updateTask={updateTask}
              systemData={systemData}
              onSaveData={handleSaveLogisticsData}
              role={profile?.role}
              defaultTab="payroll"
            />
          )}
        </div>
      </div>
    </div>
  );
}
