import React, { useState, useEffect } from 'react';
import { Play, Square, Pause, RotateCcw, Briefcase, Plus, Clock, Target, ArrowRight } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { attendanceEngine } from '../../core/engines/attendanceEngine';
import { workSessionEngine, WorkSessionContext } from '../../core/engines/workSessionEngine';

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

function ActiveTimer({ initialSeconds, isActive }: { initialSeconds: number, isActive: boolean }) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  return (
    <div className="text-3xl font-mono-data tracking-tight text-white mb-2">
      {formatTime(seconds)}
    </div>
  );
}

export function WorkSessionPanel() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const { raw } = useOperationalData();

  const [loading, setLoading] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<'OFFLINE' | 'ONLINE' | 'PAUSED'>('OFFLINE');
  const [activeSession, setActiveSession] = useState<any>(null);
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [sessionDuration, setSessionDuration] = useState(0);
  
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [resumePrompt, setResumePrompt] = useState<any>(null);
  
  const [switchState, setSwitchState] = useState({
    sessionType: 'Task',
    projectId: '',
    taskId: '',
    title: ''
  });

  const fetchData = async () => {
    if (!workspace?.id || !profile?.id) return;
    
    const currentClock = await attendanceEngine.getCurrentSession(workspace.id, profile.id);
    if (!currentClock || currentClock.event_type === 'CLOCK_OUT') {
      setAttendanceStatus('OFFLINE');
    } else if (currentClock.event_type === 'PAUSE') {
      setAttendanceStatus('PAUSED');
    } else {
      setAttendanceStatus('ONLINE');
    }

    const active = await workSessionEngine.getActiveSession(workspace.id, profile.id);
    setActiveSession(active);
    if (active) {
      setSessionDuration(Math.floor((new Date().getTime() - new Date(active.started_at).getTime()) / 1000));
    } else {
      setSessionDuration(0);
    }

    const sessions = await workSessionEngine.getTodaySessions(workspace.id, profile.id);
    setTodaySessions(sessions);
  };

  useEffect(() => {
    fetchData();
  }, [workspace?.id, profile?.id]);

  const handleClockIn = async () => {
    if (!workspace?.id || !profile?.id) return;
    setLoading(true);
    try {
      await attendanceEngine.clockIn(workspace.id, profile.id);
      await workSessionEngine.switchWorkContext(workspace.id, profile.id, {
        sessionType: 'General',
        title: 'General Administration'
      }, 'Clock In');
      await fetchData();
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!workspace?.id || !profile?.id) return;
    setLoading(true);
    try {
      await attendanceEngine.clockOut(workspace.id, profile.id);
      await fetchData();
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    if (!workspace?.id || !profile?.id) return;
    setLoading(true);
    try {
      await attendanceEngine.pauseSession(workspace.id, profile.id);
      await fetchData();
    } finally {
      setLoading(false);
    }
  };

  const handleResumeClick = async () => {
    if (!workspace?.id || !profile?.id) return;
    setLoading(true);
    try {
      const lastSession = await workSessionEngine.getLastWorkSession(workspace.id, profile.id);
      if (lastSession) {
        setResumePrompt(lastSession);
      } else {
        await executeResume(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const executeResume = async (sessionToRestore: any | null) => {
    if (!workspace?.id || !profile?.id) return;
    setLoading(true);
    try {
      await attendanceEngine.resumeSession(workspace.id, profile.id);
      if (sessionToRestore) {
        await workSessionEngine.switchWorkContext(workspace.id, profile.id, {
          sessionType: sessionToRestore.session_type,
          title: sessionToRestore.title,
          projectId: sessionToRestore.project_id,
          taskId: sessionToRestore.task_id,
          quickWorkItemId: sessionToRestore.quick_work_item_id
        }, 'Resumed Attendance');
      } else {
        setShowSwitcher(true); // Default to choosing different work if no old session
      }
      setResumePrompt(null);
      await fetchData();
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchContext = async () => {
    if (!workspace?.id || !profile?.id) return;
    setLoading(true);
    try {
      let title = switchState.title;
      if (switchState.sessionType === 'Project' && switchState.projectId) {
        const p = raw.projects.find(x => x.id === switchState.projectId);
        if (p) title = `Working on Project: ${p.name}`;
      } else if (switchState.sessionType === 'Task' && switchState.taskId) {
        const t = raw.tasks.find(x => x.id === switchState.taskId);
        if (t) title = `Task: ${t.name}`;
      }

      await workSessionEngine.switchWorkContext(workspace.id, profile.id, {
        sessionType: switchState.sessionType,
        title: title || switchState.sessionType,
        projectId: switchState.projectId || undefined,
        taskId: switchState.taskId || undefined
      }, 'Context Switch');
      
      setShowSwitcher(false);
      setSwitchState({ sessionType: 'Task', projectId: '', taskId: '', title: '' });
      await fetchData();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-2 border border-[var(--border-soft)] rounded-xl p-6 relative overflow-hidden flex flex-col gap-6">
      <div className="flex justify-between items-start border-b border-[var(--border-soft)] pb-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-text-primary uppercase flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-400" />
            Operational Command
          </h2>
          <p className="text-xs text-text-tertiary mt-1">Manage attendance, current focus, and daily activity timeline.</p>
        </div>
        
        <div className="flex gap-2 bg-[var(--surface-highest)] p-1 rounded-lg border border-[var(--border-soft)]">
          {attendanceStatus === 'OFFLINE' ? (
            <button disabled={loading} onClick={handleClockIn} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50">
              <Play className="w-4 h-4" /> Clock In
            </button>
          ) : (
            <>
              {attendanceStatus === 'ONLINE' ? (
                <button disabled={loading} onClick={handlePause} className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50">
                  <Pause className="w-4 h-4" /> Pause
                </button>
              ) : (
                <button disabled={loading || resumePrompt !== null} onClick={handleResumeClick} className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50">
                  <RotateCcw className="w-4 h-4" /> Resume
                </button>
              )}
              <button disabled={loading} onClick={handleClockOut} className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50">
                <Square className="w-4 h-4" /> Clock Out
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-4 border-r border-[var(--border-soft)] pr-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Active Session
            </h3>
            {attendanceStatus === 'ONLINE' && !showSwitcher && !resumePrompt && (
              <button onClick={() => setShowSwitcher(true)} className="text-[10px] uppercase font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 bg-indigo-500/10 px-2 py-1 rounded">
                Switch Context <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {attendanceStatus === 'OFFLINE' && (
            <div className="flex-1 flex items-center justify-center bg-black/20 rounded-xl border border-[var(--border-soft)] border-dashed">
              <p className="text-xs text-text-tertiary">Clock in to start a work session.</p>
            </div>
          )}

          {resumePrompt && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-black/20 rounded-xl border border-indigo-500/30 p-6 animate-in fade-in zoom-in duration-200">
              <div className="text-center">
                <h4 className="text-sm font-bold text-white mb-1">Resume previous work?</h4>
                <p className="text-xs text-indigo-300 font-mono">{resumePrompt.title || 'General Work'}</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button onClick={() => executeResume(resumePrompt)} className="flex-1 px-4 py-2 bg-indigo-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-indigo-600 transition-colors">
                  Resume
                </button>
                <button onClick={() => executeResume(null)} className="flex-1 px-4 py-2 bg-[var(--surface-highest)] text-text-primary rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-[var(--surface-hover)] transition-colors border border-[var(--border-soft)]">
                  Different Work
                </button>
              </div>
            </div>
          )}

          {attendanceStatus !== 'OFFLINE' && !showSwitcher && !resumePrompt && (
            <div className="flex-1 flex flex-col items-center justify-center bg-black/20 rounded-xl border border-[var(--border-soft)] p-6">
              <ActiveTimer initialSeconds={sessionDuration} isActive={attendanceStatus === 'ONLINE' && !!activeSession} />
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">
                {attendanceStatus === 'PAUSED' ? <span className="text-amber-400">PAUSED</span> : 'ACTIVE'}
              </div>
              <div className="text-sm font-semibold text-text-primary text-center">
                {activeSession?.title || activeSession?.session_type || 'General Work'}
              </div>
              {activeSession?.project && (
                <div className="text-[10px] text-text-tertiary mt-1">Project: {activeSession.project.name}</div>
              )}
            </div>
          )}

          {showSwitcher && !resumePrompt && (
            <div className="flex-1 flex flex-col gap-3 bg-black/20 rounded-xl border border-indigo-500/30 p-4 relative">
              <h4 className="text-[11px] font-bold uppercase text-indigo-400 tracking-wider">Switch Work Context</h4>
              
              <div>
                <label className="block text-[10px] text-text-tertiary uppercase mb-1">Type</label>
                <select 
                  value={switchState.sessionType} 
                  onChange={e => setSwitchState({...switchState, sessionType: e.target.value, title: ''})}
                  className="w-full input-premium py-1.5 px-2 text-xs"
                >
                  <option value="Task">Link to Task</option>
                  <option value="Project">Link to Project</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Ad-hoc">Quick Work Item</option>
                  <option value="General">General Admin</option>
                </select>
              </div>

              {switchState.sessionType === 'Project' && (
                <div>
                  <label className="block text-[10px] text-text-tertiary uppercase mb-1">Select Project</label>
                  <select value={switchState.projectId} onChange={e => setSwitchState({...switchState, projectId: e.target.value})} className="w-full input-premium py-1.5 px-2 text-xs">
                    <option value="" disabled>Select Project...</option>
                    {raw.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {switchState.sessionType === 'Task' && (
                <div>
                  <label className="block text-[10px] text-text-tertiary uppercase mb-1">Select Task</label>
                  <select value={switchState.taskId} onChange={e => setSwitchState({...switchState, taskId: e.target.value})} className="w-full input-premium py-1.5 px-2 text-xs">
                    <option value="" disabled>Select Task...</option>
                    {raw.tasks.map(t => <option key={t.id} value={t.id}>{(t as any).task_number} - {t.name}</option>)}
                  </select>
                </div>
              )}

              {(['Meeting', 'Ad-hoc', 'General'].includes(switchState.sessionType)) && (
                <div>
                  <label className="block text-[10px] text-text-tertiary uppercase mb-1">Description / Title</label>
                  <input type="text" value={switchState.title} onChange={e => setSwitchState({...switchState, title: e.target.value})} placeholder="What are you working on?" className="w-full input-premium py-1.5 px-2 text-xs" />
                </div>
              )}

              <div className="flex gap-2 justify-end mt-2">
                <button onClick={() => setShowSwitcher(false)} className="px-3 py-1.5 text-[10px] font-bold uppercase btn-premium-secondary rounded text-text-secondary">Cancel</button>
                <button onClick={handleSwitchContext} disabled={loading} className="px-3 py-1.5 text-[10px] font-bold uppercase btn-premium-primary rounded text-white">Switch Context</button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5" /> Today's Activity Timeline
          </h3>
          <div className="flex-1 bg-black/20 rounded-xl border border-[var(--border-soft)] p-4 overflow-y-auto max-h-[250px] scrollbar-premium">
            {todaySessions.length === 0 ? (
              <p className="text-xs text-text-quaternary text-center mt-8">No recorded activity for today.</p>
            ) : (
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[var(--border-soft)] before:to-transparent">
                {todaySessions.map((session, i) => (
                  <div key={session.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-4 h-4 rounded-full border border-indigo-500 bg-[var(--surface-lowest)] text-indigo-400 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 mx-auto">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                    </div>
                    <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] bg-surface-3 p-3 rounded-lg border border-[var(--border-soft)] shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono text-indigo-400 uppercase">{session.session_type}</span>
                        <span className="text-[10px] text-text-quaternary font-mono">
                          {new Date(session.started_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
                          {session.ended_at ? ` - ${new Date(session.ended_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : ' - Now'}
                        </span>
                      </div>
                      <p className="text-xs text-text-primary font-medium">{session.title || 'General Work'}</p>
                      {session.duration_seconds > 0 && (
                        <p className="text-[10px] text-text-tertiary mt-1">Duration: {Math.floor(session.duration_seconds / 60)} mins</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
