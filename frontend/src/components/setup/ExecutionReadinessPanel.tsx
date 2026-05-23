import React, { useMemo } from 'react';
import { CheckCircle, AlertTriangle, XCircle, HelpCircle, Target, GitBranch, Clock, Users, Calendar, BarChart3 } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';

interface CheckItem {
  label: string;
  description: string;
  guidance: string;
  impact: string;
  passed: boolean;
  type: 'success' | 'warning' | 'error' | 'info';
  icon: React.ReactNode;
}

interface ExecutionReadinessPanelProps {
  projectId: string;
  compact?: boolean;
}

export function ExecutionReadinessPanel({ projectId, compact }: ExecutionReadinessPanelProps) {
  const { projects, epics: allEpics, tasks } = useDashboard();

  const project = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);
  const projectTasks = useMemo(() => tasks.filter(t => t.project_id === projectId), [tasks, projectId]);
  const projectEpics = useMemo(() => allEpics?.filter((e: any) => e.project_id === projectId) || [], [allEpics, projectId]);

  const checks = useMemo((): CheckItem[] => {
    if (!project) return [];

    const hasTeam = !!project.team_id;
    const hasEpics = projectEpics.length > 0;
    const hasTasks = projectTasks.length > 0;
    const hasEstimates = projectTasks.some(t => Number(t.estimated_hours) > 0 || Number(t.story_points) > 0);
    const hasStartDate = !!project.proposed_start_date;
    const hasDeadline = !!project.deadline;
    const hasPert = Number(project.pert_best) > 0 && Number(project.pert_likely) > 0 && Number(project.pert_worst) > 0;
    const hasSprintStructure = project.execution_mode === 'SCRUM' || project.execution_mode === 'HYBRID';

    return [
      {
        label: 'Team Assigned',
        description: 'Capacity planning and workload distribution.',
        guidance: hasTeam
          ? 'Team assigned. Capacity tracking and workload balancing are active.'
          : 'No team assigned. Workload distribution will not be calculated. Assign a team in project settings.',
        impact: 'Without a team, velocity forecasting and capacity planning remain unavailable.',
        passed: hasTeam,
        type: hasTeam ? 'success' : 'warning',
        icon: <Users className="w-3.5 h-3.5" />,
      },
      {
        label: 'Timeline Defined',
        description: 'Start and end dates for deadline prediction.',
        guidance: hasStartDate && hasDeadline
          ? 'Timeline boundaries set. Delivery confidence and drift tracking are operational.'
          : 'Missing start or end date. Timeline impact analysis will not function without both boundaries.',
        impact: 'Without dates, delay drift detection and predicted completion remain disabled.',
        passed: hasStartDate && hasDeadline,
        type: hasStartDate && hasDeadline ? 'success' : 'warning',
        icon: <Calendar className="w-3.5 h-3.5" />,
      },
      {
        label: 'Estimation Baseline',
        description: 'PERT estimates for delivery confidence.',
        guidance: hasPert
          ? 'PERT estimates configured. Delivery confidence and risk detection are calibrated.'
          : 'No PERT estimates provided. Velocity forecasting may become inaccurate without effort baselines.',
        impact: 'Without PERT, risk assessment and drift prediction rely on defaults and may be inaccurate.',
        passed: hasPert,
        type: hasPert ? 'success' : hasTasks ? 'warning' : 'info',
        icon: <BarChart3 className="w-3.5 h-3.5" />,
      },
      {
        label: 'Epics Created',
        description: 'Execution objective organization.',
        guidance: hasEpics
          ? `${projectEpics.length} epic(s) created. Work is structurally organized.`
          : 'No epics created. Work lacks strategic grouping, which reduces sprint clarity and planning coherence.',
        impact: 'Without epics, large objectives fragment into disconnected tasks, reducing operational cohesion.',
        passed: hasEpics,
        type: hasEpics ? 'success' : hasTasks ? 'warning' : 'info',
        icon: <GitBranch className="w-3.5 h-3.5" />,
      },
      {
        label: hasSprintStructure ? 'Sprint Ready' : 'Tasks Created',
        description: hasSprintStructure ? 'Sprint cadence configured.' : 'Actionable units of work.',
        guidance: hasTasks
          ? `${projectTasks.length} task(s) in backlog. Execution queue is populated.`
          : 'No tasks created. The backlog is empty and no work is queued for execution.',
        impact: hasSprintStructure
          ? 'Without tasks, sprints have no actionable content and velocity cannot be measured.'
          : 'An empty backlog means no work is queued. Create tasks to populate the execution pipeline.',
        passed: hasTasks,
        type: hasTasks ? 'success' : 'warning',
        icon: <Clock className="w-3.5 h-3.5" />,
      },
      {
        label: 'Work Estimated',
        description: 'Hours or points for velocity tracking.',
        guidance: hasEstimates
          ? 'Work items have estimates. Velocity tracking and burndown projection are operational.'
          : 'No estimations provided. Sprint velocity forecasting may become inaccurate without effort sizing.',
        impact: 'Without estimates, burndown charts and velocity metrics cannot be calculated.',
        passed: hasEstimates,
        type: hasEstimates ? 'success' : hasTasks ? 'warning' : 'info',
        icon: <BarChart3 className="w-3.5 h-3.5" />,
      },
    ];
  }, [project, projectEpics, projectTasks]);

  const score = useMemo(() => {
    if (checks.length === 0) return 0;
    const passed = checks.filter(c => c.passed).length;
    return Math.round((passed / checks.length) * 100);
  }, [checks]);

  const getScoreColor = () => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreLabel = () => {
    if (score >= 80) return 'Ready';
    if (score >= 50) return 'Needs Work';
    return 'Not Ready';
  };

  if (!project) return null;

  const iconForType = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
      default: return <HelpCircle className="w-4 h-4 text-white/30 shrink-0" />;
    }
  };

  if (compact) {
    return (
      <div className="border border-white/10 rounded-lg p-4 bg-white/[0.02]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-white/40" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/50">Execution Readiness</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-mono font-bold ${getScoreColor()}`}>{score}%</span>
            <span className={`text-[9px] font-mono uppercase tracking-wider ${getScoreColor()}`}>{getScoreLabel()}</span>
          </div>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="border border-white/10 rounded-lg p-5 bg-white/[0.02]">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.03] border border-white/5">
            <Target className="w-5 h-5 text-white/40" />
          </div>
          <div>
            <h3 className="text-sm font-mono uppercase tracking-widest text-white/70">Execution Readiness</h3>
            <p className="text-[10px] text-white/40 mt-0.5">Operational preparedness checklist</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-mono font-bold ${getScoreColor()}`}>{score}%</div>
          <div className={`text-[9px] font-mono uppercase tracking-wider ${getScoreColor()}`}>{getScoreLabel()}</div>
        </div>
      </div>

      <div className="space-y-1">
        {checks.map((check, i) => (
          <div
            key={i}
            className="group relative flex items-start gap-3 p-3 rounded-sm hover:bg-white/[0.02] transition-colors cursor-default"
          >
            <div className="mt-0.5 shrink-0">{iconForType(check.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {check.icon}
                <span className={`text-xs font-mono ${check.passed ? 'text-white/70' : 'text-white/50'}`}>{check.label}</span>
                <span className={`text-[9px] font-mono uppercase ${
                  check.type === 'success' ? 'text-emerald-400/60' :
                  check.type === 'warning' ? 'text-amber-400/60' :
                  check.type === 'error' ? 'text-red-400/60' :
                  'text-white/20'
                }`}>{check.passed ? 'Ready' : 'Pending'}</span>
              </div>
              <p className="text-[10px] text-white/30 mt-1 leading-relaxed">{check.description}</p>
              <div className="mt-1.5 pt-1.5 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[9px] text-white/40 leading-relaxed">{check.guidance}</p>
                {!check.passed && (
                  <p className="text-[9px] text-amber-400/60 mt-1 leading-relaxed">{check.impact}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
