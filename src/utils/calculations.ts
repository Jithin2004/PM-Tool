import { Project, AppConfig } from '../types';

export function calcProjectRealHours(p: Project, config: AppConfig): number {
  const buf = 1 + (config.bufferPercent / 100);
  const oh = p.overhead || config.defaultOverhead;
  
  // v3: PERT Estimation (Best + 4*Expected + Worst) / 6
  const best = p.bestCaseHours || 0;
  const expected = p.expectedCaseHours || 0;
  const worst = p.worstCaseHours || 0;
  const pertCore = best && expected && worst 
    ? (best + 4 * expected + worst) / 6 
    : expected; // Fallback to expected if others missing
    
  const customOhHours = (p.overheadItems || []).reduce((s, i) => s + (i.hours || 0), 0);
  
  // v3: Add Context Switch Cost
  const contextSwitch = config.contextSwitchCost || 0;
  
  // v4 calibration: apply historical bias if we have data
  // This is passed in but for now let's keep the core pure
  
  return (pertCore * oh * buf) + customOhHours + contextSwitch;
}

export function calcHistoricalBias(projects: Project[]): number {
  const completed = projects.filter(p => p.status === 'done' && p.actualHours && p.actualHours > 0);
  if (completed.length === 0) return 1.0;
  
  let totalRatio = 0;
  completed.forEach(p => {
    // We need config to re-calc what the estimate was, or we just compare to predicted core
    const est = (p.bestCaseHours + 4 * p.expectedCaseHours + p.worstCaseHours) / 6;
    if (est > 0) {
      totalRatio += (p.actualHours || 0) / est;
    }
  });
  
  return totalRatio / completed.length;
}

export function forecastProjects(projects: Project[], config: AppConfig): Project[] {
  const active = projects
    .filter(p => p.status !== 'done')
    .sort((a, b) => a.priority - b.priority || a.id - b.id);
  
  const done = projects.filter(p => p.status === 'done');
  
  const bias = calcHistoricalBias(projects);
  const teams = Array.from(new Set(active.map(p => p.teamId || 'unassigned')));
  let allForecasted: Project[] = [];

  teams.forEach(teamId => {
    const teamProjects = active.filter(p => (p.teamId || 'unassigned') === teamId);
    let cursor = new Date();
    let projectsHandled = 0;
    
    teamProjects.forEach(p => {
      projectsHandled++;
      const baseHours = calcProjectRealHours(p, config) * bias; // Applied historical bias
      
      // v3: Non-Linear Context Switching 
      // The more projects in the queue, the higher the penalty for each new one
      const switchPenalty = config.contextSwitchCost * Math.log2(projectsHandled + 1);
      
      // v3: Productivity Decay (Tiredness Model)
      // If a project is long, the later hours are "more expensive"
      const totalHours = baseHours + switchPenalty;
      let effectiveHours = 0;
      let daysCounter = 0;
      
      let remaining = totalHours;
      while (remaining > 0) {
        daysCounter++;
        let availableToday = config.hoursPerDay;
        
        // Apply decay to hours worked after hour 6
        if (availableToday > 6) {
          const freshHours = 6;
          const tiredHours = (availableToday - 6) * config.fatigueFactor;
          availableToday = freshHours + tiredHours;
        }
        
        const wrapWork = Math.min(remaining, availableToday);
        remaining -= wrapWork;
      }
      
      const myDaysWait = p.waitDays || 0;
      const pStart = new Date(cursor).toISOString().slice(0, 10);
      
      // Advance by work days + wait days
      cursor.setDate(cursor.getDate() + daysCounter + myDaysWait);
      
      const pEnd = new Date(cursor).toISOString().slice(0, 10);
      
      const deadline = new Date(p.clientDeadline);
      const pred = new Date(pEnd);
      const diff = Math.round((pred.getTime() - deadline.getTime()) / 86400000);
      
      allForecasted.push({
        ...p,
        predictedStart: pStart,
        predictedEnd: pEnd,
        delayDays: diff,
        health: diff <= 0 ? 'ok' : diff <= 3 ? 'risk' : 'late'
      } as Project);
    });
  });

  const processedDone = done.map(p => ({
    ...p,
    health: 'done',
    delayDays: 0
  } as Project));

  return [...allForecasted, ...processedDone];
}
