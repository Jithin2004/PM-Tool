import React, { useState, useEffect, useMemo } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { activityLogService, ActivityLogEntry } from '../../services/activityLogService';
import { fetchTaskComments, createTaskComment, archiveTaskComment, updateTaskComment, TaskComment } from '../../services/taskCommentService';
import { MessageSquare, Play, Square, Pause, AlertTriangle, ShieldAlert, CheckCircle2, Tag, Edit2, Trash, Send, Gavel, HelpCircle } from 'lucide-react';

interface TaskPulseProps {
  taskId: string;
  users: any[];
  currentUserProfile: any;
  notify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type PulseEventType = 'comment' | 'activity' | 'session_start' | 'session_end';

interface PulseEvent {
  id: string;
  type: PulseEventType;
  timestamp: string;
  userId: string | null;
  data: any; // TaskComment | ActivityLogEntry | WorkSession
}

export function TaskPulse({ taskId, users, currentUserProfile, notify }: TaskPulseProps) {
  const { workspace } = useWorkspace() as any;
  const { raw: { workSessions = [] } } = useOperationalData();
  
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Comment input state
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    if (workspace?.id && taskId) {
      fetchPulse();
    }
  }, [taskId, workspace?.id]);

  const fetchPulse = useCallback(async () => {
    if (!task) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [fetchedComments, fetchedLogs] = await Promise.all([
        fetchTaskComments(taskId),
        activityLogService.getLogs(workspace.id, undefined, taskId)
      ]);
      setComments(fetchedComments);
      setLogs(fetchedLogs);
    } finally {
      setLoading(false);
    }
  }, [task, taskId, workspace?.id, fetchTaskComments]);

  const pulseEvents = useMemo(() => {
    const events: PulseEvent[] = [];

    // 1. Comments
    comments.forEach(c => {
      events.push({
        id: `comment-${c.id}`,
        type: 'comment',
        timestamp: c.created_at,
        userId: c.author_id,
        data: c
      });
    });

    // 2. Activity Logs
    logs.forEach(l => {
      events.push({
        id: `log-${l.id}`,
        type: 'activity',
        timestamp: l.created_at,
        userId: l.actor_id,
        data: l
      });
    });

    // 3. Work Sessions
    const taskSessions = workSessions.filter(ws => ws.task_id === taskId);
    taskSessions.forEach(ws => {
      events.push({
        id: `session-start-${ws.id}`,
        type: 'session_start',
        timestamp: ws.start_time,
        userId: ws.user_id,
        data: ws
      });
      if (ws.end_time) {
        events.push({
          id: `session-end-${ws.id}`,
          type: 'session_end',
          timestamp: ws.end_time,
          userId: ws.user_id,
          data: ws
        });
      }
    });

    // Sort oldest first
    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [comments, logs, workSessions, taskId]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !workspace?.id || !currentUserProfile?.id) return;

    try {
      setIsSubmitting(true);
      const comment = await createTaskComment(
        workspace.id,
        taskId,
        currentUserProfile.id,
        newComment.trim(),
        users
      );
      if (comment) {
        setComments([...comments, comment]);
        setNewComment('');
      } else {
        notify('Failed to post comment', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editContent.trim() || !workspace?.id || !currentUserProfile?.id) return;
    setIsSubmitting(true);
    try {
      const success = await updateTaskComment(commentId, editContent.trim(), workspace.id, currentUserProfile.id, taskId);
      if (success) {
        setComments(comments.map(c => c.id === commentId ? { ...c, content: editContent.trim() } : c));
        setEditingId(null);
      } else {
        notify('Failed to update comment', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string, authorId: string) => {
    const canModerate = ['super_admin', 'pm'].includes(currentUserProfile?.role);
    const isOwner = currentUserProfile?.id === authorId;
    
    if (!canModerate && !isOwner) {
      notify('You can only delete your own comments.', 'error');
      return;
    }

    if (!workspace?.id || !currentUserProfile?.id) return;
    
    const success = await archiveTaskComment(commentId, workspace.id, currentUserProfile.id, taskId);
    if (success) {
      setComments(comments.filter(c => c.id !== commentId));
    } else {
      notify('Failed to delete comment', 'error');
    }
  };

  if (loading) {
    return <div className="text-[10px] text-text-quaternary font-mono text-center mt-10"><span className="animate-pulse tracking-widest uppercase">Loading Work History...</span></div>;
  }

  return (
    <div className="flex flex-col h-[400px]">
      <div className="flex-1 overflow-y-auto p-2 pr-4 space-y-6 mb-4 relative" style={{ scrollBehavior: 'smooth' }}>
        {/* Vertical Timeline Line */}
        <div className="absolute top-4 bottom-4 left-[21px] w-px bg-border-subtle z-0" />

        {pulseEvents.length === 0 ? (
          <div className="text-[10px] text-text-quaternary font-mono text-center mt-10 z-10 relative">No pulse history yet.</div>
        ) : (
          pulseEvents.map((event, index) => {
            const isLast = index === pulseEvents.length - 1;
            const u = users.find(u => u.id === event.userId);
            const userName = u?.full_name || u?.email || 'System';

            let iconNode = <div className="w-2 h-2 rounded-full bg-text-tertiary" />;
            let contentNode = null;

            if (event.type === 'comment') {
              const c = event.data as TaskComment;
              const isDecision = c.metadata?.is_decision === true;
              const hasQuestion = c.metadata?.has_question === true;

              iconNode = isDecision ? (
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0 z-10 border border-emerald-500/30 flex items-center justify-center">
                  <Gavel className="w-3.5 h-3.5" />
                </div>
              ) : hasQuestion ? (
                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 shrink-0 z-10 border border-amber-500/30 flex items-center justify-center">
                  <HelpCircle className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded bg-surface overflow-hidden shrink-0 z-10 border border-border shadow-sm flex items-center justify-center text-[10px] font-bold text-text-secondary">
                  {c.author?.avatar_url ? (
                    <img src={c.author.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    (c.author?.full_name || c.author?.email || '?').charAt(0).toUpperCase()
                  )}
                </div>
              );

              const cardBg = isDecision
                ? "bg-emerald-950/25 border-emerald-500/40 text-emerald-100"
                : "bg-bg border-border-subtle";

              contentNode = (
                <div className={`${cardBg} border p-3 rounded-md w-full shadow-sm relative`}>
                  <div className={`absolute left-[-5px] top-3 w-2.5 h-2.5 ${isDecision ? 'bg-[#0f2118] border-l border-b border-emerald-500/40' : 'bg-bg border-l border-b border-border-subtle'} transform rotate-45`} />
                  <div className="flex justify-between items-start mb-1 relative z-10">
                    <span className="text-[10px] font-mono font-semibold text-text-primary flex items-center gap-1.5">
                      {c.author?.full_name || c.author?.email || 'Former Member'}
                      {isDecision && (
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30">
                          Decision
                        </span>
                      )}
                      {c.metadata?.needs_response && (
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30">
                          Needs Response
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-text-quaternary">
                        {new Date(c.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                      </span>
                      {currentUserProfile?.id === c.author_id && (
                        <button onClick={() => { setEditingId(c.id); setEditContent(c.content); }} className="text-text-quaternary hover:text-accent-primary transition-colors">
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                      {(currentUserProfile?.id === c.author_id || ['super_admin', 'pm'].includes(currentUserProfile?.role)) && (
                        <button onClick={() => handleDeleteComment(c.id, c.author_id)} className="text-text-quaternary hover:text-signal-error transition-colors">
                          <Trash className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  {editingId === c.id ? (
                    <div className="mt-2 relative z-10">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        className="w-full bg-surface-1 border border-border p-2 text-xs font-mono text-text-primary focus:border-accent-primary focus:outline-none transition-colors resize-none h-[60px] rounded"
                      />
                      <div className="flex gap-2 mt-2 justify-end">
                        <button onClick={() => setEditingId(null)} className="text-[9px] uppercase tracking-wide text-text-quaternary hover:text-text-secondary">Cancel</button>
                        <button onClick={() => handleUpdateComment(c.id)} disabled={isSubmitting} className="text-[9px] uppercase tracking-wide bg-accent-primary text-[var(--pm-text)] text-[var(--text-primary)] px-2 py-1 rounded">Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className={`text-xs ${isDecision ? 'text-emerald-100/90' : 'text-text-secondary'} whitespace-pre-wrap leading-relaxed relative z-10`}>
                      {c.content}
                    </div>
                  )}
                </div>
              );
            } else if (event.type === 'activity') {
              const l = event.data as ActivityLogEntry;
              const isBlock = l.action.includes('blocked');
              const isStatus = l.action.includes('status');
              const isApproval = l.action.includes('approv');
              
              iconNode = (
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${
                  isBlock ? 'bg-signal-error/20 text-signal-error' :
                  isApproval ? 'bg-signal-success/20 text-signal-success' :
                  isStatus ? 'bg-accent-primary/20 text-accent-primary' :
                  'bg-surface-3 border border-border text-text-tertiary'
                }`}>
                  {isBlock ? <ShieldAlert className="w-3 h-3" /> :
                   isApproval ? <CheckCircle2 className="w-3 h-3" /> :
                   isStatus ? <Tag className="w-3 h-3" /> :
                   <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                </div>
              );

              contentNode = (
                <div className="flex-1 flex flex-col pt-1">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-mono text-text-secondary">
                      <strong className="text-text-primary">{userName}</strong> {l.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[9px] font-mono text-text-quaternary shrink-0">
                      {new Date(event.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  {Object.keys(l.metadata || {}).length > 0 && (
                    <div className="text-[9px] font-mono text-text-tertiary mt-1 bg-surface-1 p-1.5 rounded border border-border-subtle inline-block self-start">
                      {l.metadata.old_status && l.metadata.new_status ? (
                        <span>{l.metadata.old_status} &rarr; {l.metadata.new_status}</span>
                      ) : (
                        <span>{JSON.stringify(l.metadata)}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            } else if (event.type === 'session_start' || event.type === 'session_end') {
              const isStart = event.type === 'session_start';
              iconNode = (
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${
                  isStart ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'
                }`}>
                  {isStart ? <Play className="w-3 h-3 translate-x-0.5" /> : <Square className="w-3 h-3" />}
                </div>
              );
              contentNode = (
                <div className="flex-1 flex justify-between items-center pt-1">
                  <span className="text-[10px] font-mono text-text-secondary">
                    <strong className="text-text-primary">{userName}</strong> {isStart ? 'started working on this task' : 'stopped working on this task'}
                  </span>
                  <span className="text-[9px] font-mono text-text-quaternary shrink-0">
                    {new Date(event.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              );
            }

            return (
              <div key={event.id} className={`flex gap-3 relative z-10 ${isLast ? 'mb-4' : ''}`}>
                <div className="w-6 flex justify-center shrink-0">
                  {iconNode}
                </div>
                {contentNode}
              </div>
            );
          })
        )}
      </div>

      {/* Input Box */}
      <form onSubmit={handlePostComment} className="flex gap-2 items-end pt-3 border-t border-border-subtle shrink-0">
        <textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Add an update to the timeline..."
          className="flex-1 bg-surface-1 border border-border rounded p-2.5 text-xs font-mono text-text-primary placeholder-text-quaternary focus:border-accent-primary focus:outline-none transition-colors resize-none h-[60px]"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handlePostComment(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={isSubmitting || !newComment.trim()}
          className="h-[60px] px-4 rounded bg-accent-primary hover:bg-accent-primary/90 text-[var(--pm-text)] text-[var(--text-primary)] flex items-center justify-center disabled:opacity-50 transition-colors shadow-sm"
          title="Post update"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
