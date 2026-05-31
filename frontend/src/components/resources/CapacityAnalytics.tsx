import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { Users, FileText, ChevronRight } from 'lucide-react';

export function CapacityAnalytics() {
  const { profiles, teams, tasks, projects } = useDashboard();

  // Generate 5 Mock "Sprints" / Time Horizons
  const horizons = ['Sprint 24', 'Sprint 25', 'Sprint 26', 'Sprint 27', 'Sprint 28'];

  // Map each team and member
  const gridData = useMemo(() => {
    return teams.filter((t: any) => t.name !== 'SYSTEM_SETTINGS').map((team: any) => {
      const devIds = team.data?.developer_ids || [];
      const pmId = team.data?.pm_id;
      const allIds = [pmId, ...devIds].filter(Boolean);
      
      const members = allIds.map((id: string) => {
        const p = profiles.find((prof: any) => prof.id === id);
        
        // Mocking horizon allocations for visual grid
        // In real app, this would intersect tasks by assignee and due dates inside each sprint
        const baseHours = tasks.filter((t: any) => t.assignee_id === id && t.status !== 'done')
          .reduce((s: number, t: any) => s + (t.estimated_hours || 0), 0);
          
        const allocations = horizons.map((_, i) => {
          // Deterministic variance based on member id + sprint index (no flickering)
          let hash = 0;
          const seed = id + String(i);
          for (let k = 0; k < seed.length; k++) {
            hash = ((hash << 5) - hash) + seed.charCodeAt(k);
            hash |= 0;
          }
          const variance = ((Math.abs(hash) % 60) - 30);
          const allocated = Math.max(0, (baseHours / horizons.length) * 4 + variance);
          const capacity = 40; // 1 week sprint capacity
          const util = Math.round((allocated / capacity) * 100);
          
          let signal = 'var(--pm-success)';
          let bgSignal = 'var(--pm-success-bg)';
          if (util > 100) { signal = 'var(--pm-risk)'; bgSignal = 'var(--pm-risk-bg)'; }
          else if (util > 80) { signal = 'var(--pm-warning)'; bgSignal = 'var(--pm-warning-bg)'; }
          
          return { allocated: Math.round(allocated), util, signal, bgSignal };
        });

        return { 
          id, 
          name: p?.full_name || p?.email || 'Unknown Member', 
          role: id === pmId ? 'Lead' : 'Engineer',
          allocations 
        };
      });
      return { name: team.name, members };
    });
  }, [profiles, tasks, teams]);

  const renderAvatar = (name: string) => {
    const init = name.substring(0, 2).toUpperCase();
    return (
      <div className="w-7 h-7 rounded-full bg-[var(--pm-surface)] border border-[var(--pm-border)] flex items-center justify-center text-[10px] font-bold text-[var(--pm-text-secondary)] shadow-sm">
        {init}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--pm-text)]">
            Resource Orchestration
          </h1>
          <p className="text-sm mt-1 text-[var(--pm-text-secondary)]">
            Strategic resource orchestration and forward-looking constraints.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-1.5 bg-[var(--pm-surface-elevated)] border border-[var(--pm-border)] rounded-lg text-xs font-semibold flex items-center gap-2 hover:bg-[var(--pm-surface-hover)] transition-colors text-[var(--pm-text)] cursor-pointer">
            <FileText className="w-4 h-4"/> Export Grid
          </button>
        </div>
      </div>

      <div className="bg-[var(--pm-surface-elevated)] rounded-xl border border-[var(--pm-border)] overflow-hidden shadow-sm overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Grid Header */}
          <div className="flex border-b border-[var(--pm-border)] bg-[var(--pm-surface)]/50">
            <div className="w-64 p-4 text-[10px] font-mono uppercase tracking-widest text-[var(--pm-text-secondary)]">
              Human Layer (Teams)
            </div>
            {horizons.map(h => (
              <div key={h} className="flex-1 p-4 text-[10px] font-mono uppercase tracking-widest text-[var(--pm-text-secondary)] text-center border-l border-[var(--pm-border)]/50">
                {h}
              </div>
            ))}
          </div>

          {/* Grid Body */}
          <div className="divide-y divide-[var(--pm-border)]/50">
            {gridData.map(team => (
              <div key={team.name} className="flex flex-col">
                <div className="p-3 bg-[var(--pm-surface)]/30 border-y border-[var(--pm-border)]/30 text-xs font-medium text-[var(--pm-primary)] uppercase tracking-wide flex items-center gap-2">
                  <Users className="w-4 h-4" /> {team.name}
                </div>
                {team.members.map(member => (
                  <div key={member.id} className="flex hover:bg-[var(--pm-surface-hover)] transition-colors group cursor-pointer">
                    
                    {/* Identity Cell */}
                    <div className="w-64 p-3 flex items-center gap-3">
                      {renderAvatar(member.name)}
                      <div>
                        <div className="text-sm font-medium text-[var(--pm-text)]">{member.name}</div>
                        <div className="text-[10px] text-[var(--pm-text-secondary)] font-mono uppercase mt-0.5">{member.role}</div>
                      </div>
                    </div>
                    
                    {/* Allocation Cells */}
                    {member.allocations.map((alloc, idx) => (
                      <div key={idx} className="flex-1 p-3 border-l border-[var(--pm-border)]/50 flex flex-col justify-center items-center relative group-hover:bg-[var(--pm-surface)]/5 transition-colors">
                        <div className="absolute inset-0 m-1.5 rounded bg-[var(--pm-surface-highest)] opacity-20 pointer-events-none" />
                        
                        <div className="relative z-10 w-full h-8 rounded border flex items-center justify-between px-2"
                             style={{ backgroundColor: alloc.bgSignal || 'var(--pm-surface)', borderColor: alloc.signal }}>
                          <span className="text-[10px] font-mono font-bold" style={{ color: alloc.signal }}>
                            {alloc.util}%
                          </span>
                          <span className="text-[9px] font-mono text-[var(--pm-text-secondary)]">
                            {alloc.allocated}h
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
