import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { hasCapability } from '../../core/auth/permissions';
import { TeamCard } from '../../components/team/TeamCard';
import { CreateTeamModal } from '../../components/team/CreateTeamModal';
import { Plus, Search, Users, ShieldAlert, LayoutGrid } from 'lucide-react';
import { navigate } from '../../lib/navigation';


export default function OperationalTeamsPage() {
  const { profile } = useAuth();
  const { teams, profiles, projects, tasks, handleCreateTeam, handleDeleteTeam } = useDashboard();
  const canManagePeople = hasCapability(profile?.role, 'people.manage');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any>(null);

  // Filter out SYSTEM_SETTINGS and apply search
  const operationalTeams = useMemo(() => {
    return teams
      .filter(t => t.name !== 'SYSTEM_SETTINGS')
      .filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [teams, searchQuery]);

  const handleTeamClick = (teamId: string) => {
    navigate(`/company/teams/${teamId}`);
  };

  if (!hasCapability(profile?.role, 'people.view')) {
    return (
      <div className="flex h-screen items-center justify-center p-8 bg-surface text-white">
        <div className="text-center max-w-md">
          <ShieldAlert className="w-12 h-12 text-[var(--pm-primary)] mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
          <p className="text-[var(--text-secondary)]">You do not have the required permissions to view operational teams.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-surface text-white">
      {/* Header */}
      <div className="flex-shrink-0 p-6 md:p-8 border-b border-border bg-surface-2/30">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2 flex items-center gap-3">
              <LayoutGrid className="w-8 h-8 text-indigo-400" />
              Operational Teams
            </h1>
            <p className="text-[var(--text-secondary)] text-sm max-w-2xl leading-relaxed">
              Manage functional teams, monitor group capacity, and track aggregate workload metrics.
            </p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder="Search teams..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            
            {canManagePeople && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Create Team
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        {operationalTeams.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-lg mx-auto text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 border border-indigo-500/20">
              <Users className="w-10 h-10 text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold mb-4">No operational teams have been created yet.</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-8">
              Teams are the foundation of operational delivery. Creating teams allows you to assign project ownership, monitor collective capacity, and maintain clear departmental structures across your organization.
            </p>
            {canManagePeople && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold transition-all shadow-xl shadow-indigo-500/20"
              >
                <Plus className="w-5 h-5" />
                Create Team
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {operationalTeams.map(team => {
              const data = team.data as any;
              const pm = profiles.find(p => p.id === data?.pm_id);
              const devIds = data?.developer_ids || [];
              const activeProjects = projects.filter(p => p.team_id === team.id && p.status !== 'done').length;
              
              // Calculate capacity and health dynamically
              const teamTasks = tasks.filter(t => devIds.includes(t.assignee_id) && t.status !== 'done' && t.status !== 'completed');
              const overdueTasks = teamTasks.filter(t => t.due_date && new Date(t.due_date) < new Date());
              const totalCapacity = devIds.length * 5 || 5; // fallback
              
              let health: 'healthy' | 'warning' | 'overloaded' | 'idle' = 'healthy';
              if (activeProjects === 0 && teamTasks.length === 0) {
                health = 'idle';
              } else if (teamTasks.length > totalCapacity * 1.2 || overdueTasks.length > 3) {
                health = 'overloaded';
              } else if (teamTasks.length > totalCapacity || overdueTasks.length > 0) {
                health = 'warning';
              }

              const capacityPercentage = devIds.length ? Math.min(100, Math.round((teamTasks.length / totalCapacity) * 100)) : 0;
              const lastActivity = teamTasks.length > 0 ? 'Active tasks' : 'No recent activity';

              return (
                <TeamCard
                  key={team.id}
                  team={team}
                  pm={pm}
                  memberCount={devIds.length}
                  activeProjects={activeProjects}
                  capacitySummary={`${capacityPercentage}%`}
                  health={health}
                  department={data?.department || 'Unassigned'}
                  lastActivity={lastActivity}
                  onClick={() => handleTeamClick(team.id)}
                  onDuplicate={async (e) => { e.stopPropagation(); await handleCreateTeam(`${team.name} (Copy)`, pm?.id || '', [], data); }}
                  onDelete={async (e) => { e.stopPropagation(); if(confirm('Are you sure you want to delete this team?')) { await handleDeleteTeam(team.id); } }}
                  onEdit={(e) => { e.stopPropagation(); setEditingTeam(team); }}
                />
              );
            })}
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <CreateTeamModal
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateTeam}
          profiles={profiles}
        />
      )}
      {editingTeam && (
        <CreateTeamModal
          editingTeam={editingTeam}
          onClose={() => setEditingTeam(null)}
          onSubmit={handleCreateTeam} // Note: CreateTeamModal will handle update logic if editingTeam is passed
          profiles={profiles}
        />
      )}
    </div>
  );
}
