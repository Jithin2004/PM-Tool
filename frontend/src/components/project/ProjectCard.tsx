import React, { useMemo } from 'react';
import { 
  Users, ChevronRight, Clock, AlertTriangle, 
  CheckCircle2, GitPullRequest, GitMerge, Layout, Focus
} from 'lucide-react';
import { Project, Team, Profile } from '../../types';

export function ProjectCard({ 
  project, 
  teams, 
  profiles, 
  tasks = [], 
  onClick 
}: { 
  project: Project; 
  teams: Team[]; 
  profiles: Profile[]; 
  tasks?: any[]; 
  onClick: (p: Project) => void;
}) {
  const creator = profiles.find(p => p.id === project.owner_id);
  const team = teams.find(t => t.id === project.team_id);
  const teamName = team ? team.name : "Unallocated";
  
  // Real Data Computations
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const highRiskTasks = tasks.filter(t => t.risk === 'high' && t.status !== 'done');
  
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  // Delivery Confidence based on risk vs progress
  const activeRiskRatio = totalTasks > 0 ? (highRiskTasks.length / totalTasks) : 0;
  const confidence = Math.max(0, 100 - Math.round(activeRiskRatio * 100));
  
  // Last Activity
  const latestActivityTask = [...tasks].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
  const lastActivityTime = latestActivityTask ? new Date(latestActivityTask.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date(project.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  // Execution Mode (Derived from template or defaults to hybrid)
  const executionMode = project.template === 'kanban' ? 'Kanban' : project.template === 'sprint' ? 'Scrum' : 'Hybrid';
  const ModeIcon = executionMode === 'Scrum' ? Focus : executionMode === 'Kanban' ? Layout : GitMerge;

  // Visual state mapping
  const isHealthy = highRiskTasks.length === 0;
  const isCritical = highRiskTasks.length > 3;

  return (
    <div
      onClick={() => onClick(project)}
      className={`group relative premium-panel premium-hover-lift rounded-2xl p-5 cursor-pointer transition-all duration-200 ${
        isCritical 
          ? 'border-rose-500/30 shadow-[0_0_15px_rgba(239,68,68,0.08)] bg-rose-500/[0.01]' 
          : 'border-[var(--border-soft)]'
      }`}
    >
      <div className="flex flex-col h-full justify-between gap-5">
        
        {/* Header: Name, Mode, Status */}
        <div>
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--surface-glass)] px-2 py-1 rounded-lg border border-[var(--border-soft)]">
                <ModeIcon className="w-3 h-3 text-purple-400" />
                {executionMode}
              </span>
              <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-lg border ${
                project.status === 'deployed' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : project.status === 'in-progress' 
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                  : 'bg-[var(--surface-glass)] text-[var(--text-secondary)] border-[var(--border-soft)]'
              }`}>
                {project.status.replace('-', ' ')}
              </span>
            </div>
            
            {/* Risk Indicator */}
            {isCritical ? (
              <div className="flex items-center gap-1.5 text-rose-400 bg-rose-500/10 px-2 py-1 rounded-full border border-rose-500/25 shadow-[0_0_12px_rgba(239,68,68,0.15)]">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider">At Risk</span>
              </div>
            ) : isHealthy && project.status === 'in-progress' ? (
              <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider">On Track</span>
              </div>
            ) : null}
          </div>
 
          <h3 className="text-lg font-sans font-semibold text-white group-hover:text-purple-400 transition-colors line-clamp-1 mb-1">
            {project.name}
          </h3>
          <p className="text-[11px] text-[var(--text-secondary)] font-mono truncate">
            Last active: {lastActivityTime}
          </p>
        </div>
 
        {/* Progress & Metrics */}
        <div className="space-y-3">
          
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Progress</span>
              <span className="text-xs font-mono font-medium text-white">{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-[var(--surface-glass)] rounded-full overflow-hidden border border-[var(--border-soft)]">
              <div 
                className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                  progressPercent === 100 ? 'from-emerald-500 to-teal-400' : 'from-purple-500 to-indigo-500'
                }`} 
                style={{ width: `${progressPercent}%` }} 
              />
            </div>
          </div>
 
          {/* Metric Grid */}
          <div className="grid grid-cols-3 gap-2 py-2 border-y border-[var(--border-soft)]">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)] mb-0.5 font-mono">Tasks</span>
              <span className="text-xs font-mono font-medium text-[var(--text-secondary)]">{completedTasks}/{totalTasks}</span>
            </div>
            <div className="flex flex-col border-l border-[var(--border-soft)] pl-2">
              <span className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)] mb-0.5 font-mono">Confidence</span>
              <span className={`text-xs font-mono font-medium ${
                confidence > 80 ? 'text-emerald-400' : confidence > 50 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {confidence}%
              </span>
            </div>
            <div className="flex flex-col border-l border-[var(--border-soft)] pl-2">
              <span className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)] mb-0.5 font-mono">Blockers</span>
              <span className={`text-xs font-mono font-medium ${highRiskTasks.length > 0 ? 'text-rose-400' : 'text-[var(--text-secondary)]'}`}>
                {highRiskTasks.length}
              </span>
            </div>
          </div>
        </div>
 
        {/* Footer: Team & Forecast Action */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1">
              {team ? (
                <div className="w-5 h-5 rounded-full bg-[var(--surface-glass)] border border-[var(--border-soft)] flex items-center justify-center">
                  <Users className="w-3 h-3 text-[var(--text-secondary)]" />
                </div>
              ) : null}
              {creator?.avatar_url ? (
                <img src={creator.avatar_url} className="w-5 h-5 rounded-full border border-[var(--border-soft)] object-cover" alt="Owner" />
              ) : null}
            </div>
            <span className="text-[10px] font-medium text-[var(--text-secondary)]">{teamName}</span>
          </div>
          
          <button className="flex items-center gap-1 text-[10px] uppercase font-medium text-[var(--text-secondary)] group-hover:text-purple-400 transition-all font-mono">
            Forecast <ChevronRight className="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
 
      </div>
    </div>
  );
}
