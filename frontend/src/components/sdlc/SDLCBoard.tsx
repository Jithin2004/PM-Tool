import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag, FileText, Calendar, PenTool, Code, TestTube, Rocket, Activity, Users, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Task, User, Milestone, Approval, Meeting, Project } from '../../types';
import { SDLC_PHASES } from '../../constants/product';
import { TaskCard } from '../task/TaskCard';
import { TaskCreateModal } from '../task/TaskCreateModal';

const PHASE_ICONS: Record<string, React.ReactNode> = {
  initiation: <Flag className="w-4 h-4" />,
  requirements: <FileText className="w-4 h-4" />,
  planning: <Calendar className="w-4 h-4" />,
  design: <PenTool className="w-4 h-4" />,
  development: <Code className="w-4 h-4" />,
  qa: <TestTube className="w-4 h-4" />,
  release: <Rocket className="w-4 h-4" />,
  post_release: <Activity className="w-4 h-4" />
};

interface SDLCBoardProps {
  project: Project;
  workspaceId: string;
  tasks: Task[];
  users: User[];
  milestones: Milestone[];
  approvals: Approval[];
  meetings: Meeting[];
  currentUserProfile: User | null;
  notify: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onUpdateTaskStatus: (taskId: string, status: Task['status']) => Promise<void>;
  onCreateTask: (taskData: any) => Promise<void>;
}

export function SDLCBoard({ project, workspaceId, tasks, users, milestones, approvals, meetings, currentUserProfile, notify, onUpdateTaskStatus, onCreateTask }: SDLCBoardProps) {
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const hasWriteAccess = currentUserProfile?.role === 'super_admin' || currentUserProfile?.role === 'pm';

  const projectTasks = useMemo(() => tasks.filter(t => t.project_id === project.id), [tasks, project.id]);
  const projectMilestones = useMemo(() => milestones.filter(m => m.project_id === project.id), [milestones, project.id]);
  const projectApprovals = useMemo(() => approvals.filter(a => a.project_id === project.id), [approvals, project.id]);
  const projectMeetings = useMemo(() => meetings.filter(m => m.project_id === project.id), [meetings, project.id]);

  const phaseStats = useMemo(() => {
    return SDLC_PHASES.map(phase => {
      const phaseTasks = projectTasks.filter(t => (t as any).phase === phase.id || t.status === 'backlog');
      const phaseMilestones = projectMilestones.filter(m => (m as any).phase === phase.id);
      const phaseApprovals = projectApprovals.filter(a => a.phase === phase.id);
      const phaseMeetings = projectMeetings.filter(m => (m as any).phase === phase.id);
      const completedCount = phaseTasks.filter(t => t.status === 'done').length;
      const totalCount = phaseTasks.length;
      const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      const approvalStatus = phaseApprovals.find(a => a.status === 'pending') ? 'pending' : phaseApprovals.find(a => a.status === 'approved') ? 'approved' : 'none';
      return { ...phase, taskCount: totalCount, completedCount, progress, milestoneCount: phaseMilestones.length, approvalStatus, meetingCount: phaseMeetings.length };
    });
  }, [projectTasks, projectMilestones, projectApprovals, projectMeetings]);

  const filteredTasks = useMemo(() => {
    if (!activePhase) return projectTasks;
    return projectTasks.filter(t => (t as any).phase === activePhase);
  }, [projectTasks, activePhase]);

  return (
    <div className="w-full bg-bg border border-border-subtle rounded-sm p-4 sm:p-6 backdrop-blur-md relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/80 via-blue-500/80 to-cyan-500/80" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-border-subtle pb-4">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-sans tracking-tight uppercase tracking-wide text-text-primary">SDLC Pipeline</h2>
          <span className="text-[9px] font-mono text-text-quaternary">— {project.name}</span>
        </div>
        {hasWriteAccess && (
          <button onClick={() => setIsAddingTask(true)} className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-text-primary text-[9px] font-mono uppercase tracking-wide rounded-sm cursor-pointer">
            Queue Task
          </button>
        )}
      </div>

      {/* SDLC Phase Pipeline */}
      <div className="mb-6 grid grid-cols-4 sm:grid-cols-8 gap-2">
        {phaseStats.map(phase => (
          <button
            key={phase.id}
            onClick={() => setActivePhase(activePhase === phase.id ? null : phase.id)}
            className={`flex flex-col items-center gap-1 p-2 border rounded-sm transition-all cursor-pointer ${activePhase === phase.id ? 'bg-emerald-900/30 border-emerald-500/40' : 'bg-surface-3 border-border-subtle hover:border-white/15'}`}
          >
            <div className={`text-text-tertiary ${phase.progress === 100 ? 'text-emerald-400' : ''}`}>{PHASE_ICONS[phase.id]}</div>
            <span className="text-[7px] font-mono uppercase text-text-tertiary truncate w-full text-center">{phase.title}</span>
            {phase.taskCount > 0 && (
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${phase.progress}%` }} />
              </div>
            )}
            {phase.approvalStatus === 'pending' && <AlertCircle className="w-2.5 h-2.5 text-signal-warning" />}
            {phase.approvalStatus === 'approved' && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />}
          </button>
        ))}
      </div>

      {/* Milestones & Meetings summary */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-bg border border-border-subtle rounded-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Flag className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[9px] font-mono uppercase tracking-wide text-text-tertiary">Milestones</span>
          </div>
          {projectMilestones.length === 0 ? (
            <p className="text-[9px] font-mono text-text-quaternary">No milestones defined.</p>
          ) : (
            <div className="space-y-1.5">
              {projectMilestones.map(m => (
                <div key={m.id} className="flex items-center justify-between text-[9px] font-mono">
                  <span className="text-text-secondary">{m.title}</span>
                  <span className={`px-1.5 py-0.5 rounded-sm ${m.status === 'achieved' ? 'bg-emerald-500/10 text-emerald-400' : m.status === 'missed' ? 'bg-signal-critical-bg text-signal-critical' : 'bg-white/5 text-text-quaternary'}`}>{m.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-bg border border-border-subtle rounded-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-3.5 h-3.5 text-accent-secondary" />
            <span className="text-[9px] font-mono uppercase tracking-wide text-text-tertiary">Meetings</span>
          </div>
          {projectMeetings.length === 0 ? (
            <p className="text-[9px] font-mono text-text-quaternary">No meetings scheduled.</p>
          ) : (
            <div className="space-y-1.5">
              {projectMeetings.slice(0, 5).map(m => (
                <div key={m.id} className="flex items-center justify-between text-[9px] font-mono">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-2.5 h-2.5 text-text-quaternary" />
                    <span className="text-text-secondary">{m.title}</span>
                  </div>
                  <span className="text-text-quaternary">{new Date(m.start_time).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Phase task list */}
      <div className="bg-surface-3 border border-border-subtle rounded-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-sans tracking-tight uppercase tracking-wide text-text-secondary">
            {activePhase ? `${SDLC_PHASES.find(p => p.id === activePhase)?.title} Tasks` : 'All Phase Tasks'}
          </h3>
          <span className="text-[9px] font-mono text-text-quaternary">{filteredTasks.length} tasks</span>
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-text-quaternary font-mono text-[9px] uppercase">No tasks in this phase</div>
          ) : (
            filteredTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 p-3 bg-bg border border-border-subtle rounded-sm hover:border-border transition-colors">
                <div className={`w-2 h-2 rounded-full ${task.status === 'done' ? 'bg-emerald-400' : task.status === 'in_progress' ? 'bg-yellow-400' : task.status === 'review' ? 'bg-orange-400' : 'bg-white/20'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-mono text-text-secondary truncate">{task.name}</p>
                  <p className="text-[8px] font-mono text-text-quaternary uppercase">{task.status.replace('_', ' ')} · {task.estimated_hours}h</p>
                </div>
                {task.story_points && <span className="text-[8px] font-mono text-accent-secondary bg-surface-3 px-1.5 py-0.5 rounded-sm">{task.story_points} SP</span>}
              </div>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        <TaskCreateModal isOpen={isAddingTask} onClose={() => setIsAddingTask(false)} projects={[project]} users={users} defaultStatus="backlog" defaultProjectId={project.id} onSubmit={onCreateTask} notify={notify} />
      </AnimatePresence>
    </div>
  );
}
