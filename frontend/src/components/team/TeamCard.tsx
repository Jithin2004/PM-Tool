import React, { useState } from 'react';
import { Users, Briefcase, Activity, ChevronRight, MoreVertical, Edit2, Copy, Trash2, ShieldAlert, CheckCircle, Clock } from 'lucide-react';
import type { Team, Profile } from '../../types';

interface TeamCardProps {
  team: Team;
  pm?: Profile;
  memberCount: number;
  activeProjects: number;
  capacitySummary?: string;
  health?: 'healthy' | 'warning' | 'overloaded' | 'idle';
  department?: string;
  lastActivity?: string;
  onClick: () => void;
  onDuplicate?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  onEdit?: (e: React.MouseEvent) => void;
}

export function TeamCard({ team, pm, memberCount, activeProjects, capacitySummary, health = 'healthy', department = 'Unassigned', lastActivity, onClick, onDuplicate, onDelete, onEdit }: TeamCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const getInitials = (name: string) => {
    return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  };

  const healthColors = {
    healthy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    overloaded: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    idle: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };

  const HealthIcon = health === 'healthy' ? CheckCircle : health === 'warning' ? ShieldAlert : health === 'overloaded' ? Activity : Clock;

  return (
    <div 
      onClick={onClick}
      className="bg-surface-2 border border-border hover:border-indigo-500/50 rounded-xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col h-full"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 pr-2">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors truncate">
              {team.name}
            </h3>
            {department && (
              <span className="px-1.5 py-0.5 rounded bg-surface-3 text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] whitespace-nowrap">
                {department}
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
            {(team.data as any)?.description || 'No description provided.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="p-1.5 hover:bg-surface-3 rounded-md text-[var(--text-secondary)] hover:text-white transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                <div className="absolute right-0 top-full mt-1 w-40 bg-surface-2 border border-border rounded-lg shadow-xl z-20 py-1">
                  <button onClick={(e) => { setShowMenu(false); onEdit?.(e); }} className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-white hover:bg-surface-3 flex items-center gap-2">
                    <Edit2 className="w-3.5 h-3.5" /> Edit Team
                  </button>
                  <button onClick={(e) => { setShowMenu(false); onDuplicate?.(e); }} className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-white hover:bg-surface-3 flex items-center gap-2">
                    <Copy className="w-3.5 h-3.5" /> Duplicate
                  </button>
                  <button disabled className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] opacity-50 cursor-not-allowed flex items-center gap-2" title="Coming in a future release">
                    <Trash2 className="w-3.5 h-3.5" /> Archive <span className="text-[9px] uppercase tracking-wider ml-auto">Soon</span>
                  </button>
                  <button onClick={(e) => { setShowMenu(false); onDelete?.(e); }} className="w-full text-left px-3 py-2 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-2 border-t border-border mt-1 pt-2">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center border border-border group-hover:bg-indigo-500/20 transition-colors">
            <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-indigo-400" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-auto pt-2">
        <div className="flex items-center gap-2">
          {pm ? (
            <>
              {pm.avatar_url ? (
                <img src={pm.avatar_url} alt="Lead" className="w-6 h-6 rounded-full" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[10px] text-indigo-300 font-bold">
                  {getInitials(pm.full_name || pm.email)}
                </div>
              )}
              <span className="text-xs text-[var(--text-secondary)] truncate">
                <span className="font-semibold text-gray-300">Lead:</span> {pm.full_name || pm.email}
              </span>
            </>
          ) : (
            <span className="text-xs text-[var(--text-secondary)] italic">No Lead Assigned</span>
          )}
        </div>
        
        <div className="flex items-center gap-2 justify-end text-xs text-[var(--text-secondary)]">
          <Users className="w-3.5 h-3.5" />
          <span>{memberCount} members</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border flex justify-between items-center text-xs">
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <Briefcase className="w-3.5 h-3.5 text-blue-400" />
          <span>{activeProjects} Active</span>
        </div>
        
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded border ${healthColors[health]}`}>
          <HealthIcon className="w-3 h-3" />
          <span className="font-semibold uppercase tracking-wider text-[10px]">
            {health} {capacitySummary && `(${capacitySummary})`}
          </span>
        </div>
      </div>
      
      {lastActivity && (
        <div className="mt-3 text-[10px] text-[var(--text-secondary)] text-right opacity-50 uppercase tracking-widest">
          {lastActivity}
        </div>
      )}
    </div>
  );
}
