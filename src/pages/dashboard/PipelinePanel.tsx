import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import ExecutionBoard from '../../components/ExecutionBoard';
import { GanttView } from '../../components/gantt/GanttView';
import { SprintBoard } from '../../components/scrum/SprintBoard';
import { SDLCBoard } from '../../components/sdlc/SDLCBoard';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { Milestone, Approval, Meeting, Epic, Sprint } from '../../types';

export function PipelinePanel() {
  const { profile } = useAuth();
  const [viewMode, setViewMode] = useState<'board' | 'gantt'>('board');
  const { 
    projects, 
    profiles, 
    notify, 
    fetchProjects, 
    handlePromoteTaskToAsset 
  } = useDashboard();

  const [milestones] = useState<Milestone[]>([]);
  const [approvals] = useState<Approval[]>([]);
  const [meetings] = useState<Meeting[]>([]);
  const [epics] = useState<Epic[]>([]);
  const [sprints] = useState<Sprint[]>([]);

  React.useEffect(() => {
    const handleSwitch = () => setViewMode('board');
    window.addEventListener('switch-to-board', handleSwitch);
    return () => window.removeEventListener('switch-to-board', handleSwitch);
  }, []);

  const kanbanProjects = projects.filter(p => p.execution_mode !== 'SCRUM');
  const scrumProjects = projects.filter(p => p.execution_mode === 'SCRUM');
  const sdlcProjects = projects.filter(p => p.execution_mode === 'SDLC');

  return (
    <main className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12">
      <div className="flex justify-between items-center mb-8 bg-[#090a0f]/40 border border-white/10 p-4 rounded-lg backdrop-blur-md">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Pipeline Workspace</h2>
          <p className="text-[10px] font-mono text-white/50 uppercase">Operational lanes and task dependency timeline</p>
        </div>
        <div className="flex bg-black/40 border border-white/10 p-0.5 rounded-sm gap-0.5">
          <button
            onClick={() => setViewMode('board')}
            className={`px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-sm transition-all cursor-pointer ${
              viewMode === 'board'
                ? 'bg-blue-600/30 text-blue-400 border border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                : 'text-white/60 hover:text-white border border-transparent'
            }`}
          >
            Board
          </button>
          <button
            onClick={() => setViewMode('gantt')}
            className={`px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-sm transition-all cursor-pointer ${
              viewMode === 'gantt'
                ? 'bg-blue-600/30 text-blue-400 border border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                : 'text-white/60 hover:text-white border border-transparent'
            }`}
          >
            Gantt
          </button>
        </div>
      </div>

      {viewMode === 'board' ? (
        <div className="space-y-8">
          <ExecutionBoard
            projects={kanbanProjects}
            users={profiles}
            currentUserProfile={profile}
            notify={notify}
            onRecalibrateAnalytics={() => {
              fetchProjects();
            }}
            onPromoteToAsset={handlePromoteTaskToAsset}
          />

          {scrumProjects.map(project => (
            <SprintBoard
              key={project.id}
              projectId={project.id}
              workspaceId={project.workspace_id}
              sprints={sprints.filter(s => s.project_id === project.id)}
              tasks={[]}
              users={profiles}
              epics={epics.filter(e => e.project_id === project.id)}
              currentUserProfile={profile}
              notify={notify}
              onUpdateTaskStatus={async () => {}}
              onCreateTask={async () => {}}
              onCreateSprint={async () => {}}
            />
          ))}

          {sdlcProjects.map(project => (
            <SDLCBoard
              key={project.id}
              project={project}
              workspaceId={project.workspace_id}
              tasks={[]}
              users={profiles}
              milestones={milestones.filter(m => m.project_id === project.id)}
              approvals={approvals.filter(a => a.project_id === project.id)}
              meetings={meetings.filter(m => m.project_id === project.id)}
              currentUserProfile={profile}
              notify={notify}
              onUpdateTaskStatus={async () => {}}
              onCreateTask={async () => {}}
            />
          ))}
        </div>
      ) : (
        <GanttView milestones={milestones} meetings={meetings} />
      )}
    </main>
  );
}
