import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Clock, Users, ChevronRight } from 'lucide-react';
import { Project, Team, User, Profile } from '../../types';
import { calculateExpectedTime, calculateVariance, getRelativeTime } from '../../utils/timeUtils';
import { addWorkingHours, getDailyCapacity } from '../../utils/productivity';

export function ProjectCard({ project, teams, profiles, workingHoursPerDay, workingTimeFrom = '09:00', workingTimeTo = '17:00', onClick }: { project: Project; teams: Team[]; profiles: Profile[]; workingHoursPerDay: number; workingTimeFrom?: string; workingTimeTo?: string; onClick: (p: Project) => void }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const creator = profiles.find(p => p.id === project.owner_id);
  const historicalTeam = project.tags.find(t => t.startsWith('TEAM:'))?.replace('TEAM:', '');
  const team = teams.find(t => t.id === project.team_id);
  const teamName = team ? team.name : (historicalTeam || "UNALLOCATED");
  const parsedTeamData = team ? team.data : null;
  const engineerCount = Math.max(1, parsedTeamData?.developer_ids?.length || 1);

  const expectedRealHours = useMemo(() =>
    calculateExpectedTime(project.pert_best, project.pert_likely, project.pert_worst),
    [project]
  );

  const productiveHoursPerDay = workingHoursPerDay * 0.8;
  const varianceVal = calculateVariance(project.pert_best ?? 0, project.pert_worst ?? 0);
  const stdDev = isNaN(varianceVal) ? 0 : Math.sqrt(varianceVal);

  const riskColor = stdDev < 1.5 ? 'text-green-400' : stdDev < 3 ? 'text-yellow-400' : 'text-red-500';
  const riskLabel = stdDev < 1.5 ? 'STABLE' : stdDev < 3 ? 'CAUTION' : 'HIGH_RISK';

  const isPlanning = project.status === 'planning';

  // ETA using working hours only (re-computed on each tick for live countdown)
  const startDate = project.proposed_start_date ? new Date(project.proposed_start_date) : new Date(project.created_at);
  const now = useMemo(() => new Date(), [tick]);
  const workWindow = useMemo(() => ({ workStart: workingTimeFrom, workEnd: workingTimeTo, lunchDuration: 60, workingDays: [1, 2, 3, 4, 5], productivityFactor: 0.8, holidays: [], shutdowns: [] }), [workingTimeFrom, workingTimeTo]);

  const completionDate = useMemo(() => {
    if (isPlanning) return now;
    const totalHours = (expectedRealHours / engineerCount);
    return addWorkingHours(startDate, totalHours, workWindow);
  }, [startDate, expectedRealHours, engineerCount, isPlanning, now]);

  const remainingDays = useMemo(() => {
    if (isPlanning) return 0;
    if (now >= completionDate) return 0;
    let count = 0;
    let cursor = new Date(now);
    while (cursor < completionDate) {
      const cap = getDailyCapacity(cursor, workWindow);
      if (cap > 0) count += cap / workingHoursPerDay;
      cursor.setDate(cursor.getDate() + 1);
    }
    return Math.max(0, Number(count.toFixed(1)));
  }, [now, completionDate, workWindow, workingHoursPerDay, isPlanning]);

  const completionDateStr = completionDate.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div
      onClick={() => onClick(project)}
      className={`border border-white/10 bg-[#0c0c0c] p-5 group hover:border-white/30 transition-all cursor-pointer relative overflow-hidden ${stdDev >= 3 ? 'border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.05)]' : ''
        }`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.02] -mr-16 -mt-16 rounded-full blur-3xl pointer-events-none group-hover:bg-white/[0.05]"></div>
      {stdDev >= 3 && <div className="absolute top-0 left-0 w-full h-0.5 bg-red-500/50"></div>}

      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-6 mb-6">
        <div className="space-y-2 w-full sm:w-auto">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 border ${project.status === 'deployed' ? 'border-green-500/50 text-green-400 bg-green-500/15' :
              project.status === 'in-progress' ? 'border-blue-500/50 text-blue-400 bg-blue-500/15' :
                'border-white/30 text-white bg-white/20'
              }`}>
              {project.status.replace('-', ' ')}
            </span>
            <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 border border-white/20 bg-white/10 ${riskColor}`}>
              {riskLabel}
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-medium leading-tight group-hover:text-white transition-colors">{project.name}</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[10px] font-mono text-white/60 uppercase tracking-wider">{getRelativeTime(project.created_at)}</span>
            <div className="flex flex-wrap gap-1.5">
              {project.tags
                .filter(tag => !tag.startsWith('TEAM:') && !tag.startsWith('LOG:'))
                .map(tag => (
                  <span key={tag} className="text-[10px] font-mono text-white/70">#{tag}</span>
                ))}
            </div>
          </div>
          {creator && (
            <div className="mt-2.5 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/20">
                {creator.avatar_url ? (
                  <img src={creator.avatar_url} alt="Creator" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-2.5 h-2.5 text-white/70" />
                )}
              </div>
              <p className="text-[9px] font-mono text-white/50">
                By <span className="text-white/75">{creator.full_name || creator.email}</span>
              </p>
            </div>
          )}
        </div>
        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start w-full sm:w-auto pt-3 sm:pt-0 border-t border-white/5 sm:border-t-0 text-right">
          <div className="text-left sm:text-right">
            <p className="text-[9px] font-mono text-white/50 uppercase tracking-widest leading-none mb-1">Finish_ETA</p>
            <div className={`text-xl sm:text-2xl font-mono font-medium ${riskColor} leading-none`}>{remainingDays.toFixed(1)}d</div>
          </div>
          <div className="text-right mt-0 sm:mt-2">
            <p className="text-[9px] font-mono text-white/50 uppercase leading-none">{completionDateStr}</p>
            <p className="text-[10px] font-mono text-white/75 uppercase mt-1">Effort: {expectedRealHours.toFixed(1)}h</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <Users className="w-3 h-3 text-white/75" />
          <span className="text-[10px] font-mono text-white/85 uppercase tracking-widest">{teamName}</span>
        </div>
        <button className="flex items-center gap-1 text-[10px] uppercase font-mono text-white/90 hover:text-white transition-all group/btn">
          Forecast <ChevronRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
