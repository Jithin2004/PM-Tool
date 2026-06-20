import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { commentService, EntityComment } from '../../services/commentService';
import { activityEventService, ActivityEvent } from '../../services/activityEventService';
import { MentionTextarea } from './MentionTextarea';
import { MessageSquare, Clock, User, CheckCircle2, CornerDownRight, Smile, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { slideUp } from '../../lib/animation';

interface UnifiedTimelineProps {
  entityType: string;
  entityId: string;
}

type TimelineItem = 
  | { type: 'comment'; data: EntityComment; timestamp: number }
  | { type: 'activity'; data: ActivityEvent; timestamp: number };

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    task_created: 'created the task',
    task_updated: 'updated the task',
    task_completed: 'completed the task',
    comment_created: 'added a comment',
    comment_resolved: 'resolved a comment thread',
    mention: 'mentioned someone',
    reaction_added: 'reacted',
    status_changed: 'changed status',
    file_uploaded: 'uploaded a file',
    document_created: 'created the document',
    document_updated: 'updated the document',
    document_version_created: 'created a new version',
    document_approved: 'approved the document',
    document_shared: 'shared the document',
  };
  return labels[action] || action.replace(/_/g, ' ');
}

export function UnifiedTimeline({ entityType, entityId }: UnifiedTimelineProps) {
  const { user, profile } = useAuth();
  const { workspace } = useWorkspace();
  
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const loadData = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    
    const [comments, activities] = await Promise.all([
      commentService.getEntityComments(entityType, entityId),
      activityEventService.getEntityTimeline(entityType, entityId)
    ]);

    const combined: TimelineItem[] = [
      ...comments.map(c => ({ type: 'comment' as const, data: c, timestamp: new Date(c.created_at).getTime() })),
      ...activities
        // Filter out activity events that are just duplicates of comments to avoid double rendering
        .filter(a => !['comment_created', 'reaction_added', 'comment_resolved', 'mention'].includes(a.action_type))
        .map(a => ({ type: 'activity' as const, data: a, timestamp: new Date(a.created_at).getTime() }))
    ];

    // Chronological (oldest first for timeline)
    combined.sort((a, b) => a.timestamp - b.timestamp);
    setItems(combined);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [entityType, entityId, workspace?.id]);

  const handleSubmit = async () => {
    if (!newContent.trim() || !workspace?.id || !user?.id || submitting) return;
    setSubmitting(true);
    const authorName = profile?.full_name || user.email?.split('@')[0] || 'Unknown';
    const c = await commentService.createComment(workspace.id, entityType, entityId, user.id, authorName, newContent, null);
    if (c) {
      setItems(prev => [...prev, { type: 'comment', data: { ...c, replies: [], reactions: [], author_name: authorName }, timestamp: Date.now() }]);
      setNewContent('');
    }
    setSubmitting(false);
  };

  const handleReply = async (parentId: string) => {
    if (!replyContent.trim() || !workspace?.id || !user?.id || submitting) return;
    setSubmitting(true);
    const authorName = profile?.full_name || user.email?.split('@')[0] || 'Unknown';
    const c = await commentService.createComment(workspace.id, entityType, entityId, user.id, authorName, replyContent, parentId);
    if (c) {
      setItems(prev => prev.map(item => {
        if (item.type === 'comment' && item.data.id === parentId) {
          return {
            ...item,
            data: { ...item.data, replies: [...(item.data.replies || []), { ...c, author_name: authorName, replies: [], reactions: [] }] }
          };
        }
        return item;
      }));
      setReplyingTo(null);
      setReplyContent('');
    }
    setSubmitting(false);
  };

  const toggleReaction = async (commentId: string, emoji: string) => {
    if (!workspace?.id || !user?.id) return;
    await commentService.addReaction(workspace.id, commentId, user.id, emoji);
    await loadData();
  };

  const resolveThread = async (commentId: string) => {
    if (!workspace?.id || !user?.id) return;
    await commentService.resolveComment(commentId, user.id, workspace.id, entityType, entityId);
    await loadData();
  };

  if (loading) return <div className="animate-pulse h-40 bg-surface-2 rounded-lg"></div>;

  return (
    <div className="space-y-6">
      <div className="relative pl-4 border-l-2 border-surface-3 space-y-6 pb-6">
        <AnimatePresence>
          {items.map((item, index) => {
            if (item.type === 'activity') {
              const a = item.data;
              return (
                <motion.div key={a.id} variants={slideUp} initial="hidden" animate="visible" className="relative">
                  <div className="absolute -left-[25px] mt-1 w-6 h-6 rounded-full bg-surface border-2 border-surface-3 flex items-center justify-center">
                    <Activity className="w-3 h-3 text-text-quaternary" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">{a.metadata?.author_name || 'System'}</span>
                    <span>{actionLabel(a.action_type)}</span>
                    <span className="text-[10px] text-text-quaternary font-mono ml-auto">{timeAgo(a.created_at)}</span>
                  </div>
                </motion.div>
              );
            }

            if (item.type === 'comment') {
              const c = item.data;
              return (
                <motion.div key={c.id} variants={slideUp} initial="hidden" animate="visible" className="relative">
                  <div className="absolute -left-[25px] mt-1 w-6 h-6 rounded-full bg-indigo-500/20 border-2 border-surface-3 flex items-center justify-center text-indigo-400 font-bold text-[10px] uppercase">
                    {c.author_name?.charAt(0) || '?'}
                  </div>
                  
                  <div className={`p-4 rounded-xl border ${c.resolved_at ? 'bg-surface-1 border-border-subtle opacity-70' : 'bg-surface-2 border-border shadow-sm'}`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="text-xs font-semibold text-text-primary flex items-center gap-2">
                        {c.author_name}
                        <span className="text-[10px] text-text-tertiary font-normal">{timeAgo(c.created_at)}</span>
                      </div>
                      {!c.resolved_at && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => toggleReaction(c.id, '👍')} className="text-text-tertiary hover:text-text-primary p-1 rounded hover:bg-surface-hover"><Smile className="w-3.5 h-3.5" /></button>
                          <button onClick={() => resolveThread(c.id)} title="Resolve Thread" className="text-text-tertiary hover:text-emerald-400 p-1 rounded hover:bg-surface-hover"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                      {c.resolved_at && (
                        <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Resolved
                        </span>
                      )}
                    </div>
                    
                    <div className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                      {c.content.split(/(@[a-zA-Z0-9_.-]+)/g).map((part, i) => 
                        part.startsWith('@') ? <span key={i} className="text-indigo-400 font-semibold">{part}</span> : part
                      )}
                    </div>

                    {c.reactions && c.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(c.reactions.reduce((acc, r) => { acc[r.emoji] = (acc[r.emoji]||0)+1; return acc; }, {} as Record<string,number>)).map(([emoji, count]) => (
                          <span key={emoji} className="text-[10px] bg-surface-3 border border-border px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            {emoji} <span className="opacity-70">{count}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Replies */}
                    {c.replies && c.replies.length > 0 && (
                      <div className="mt-3 pl-2 space-y-3 border-l-2 border-border-subtle">
                        {c.replies.map(reply => (
                          <div key={reply.id} className="pl-3 relative">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-text-primary">{reply.author_name}</span>
                              <span className="text-[10px] text-text-tertiary">{timeAgo(reply.created_at)}</span>
                            </div>
                            <div className="text-xs text-text-secondary whitespace-pre-wrap">
                              {reply.content.split(/(@[a-zA-Z0-9_.-]+)/g).map((part, i) => 
                                part.startsWith('@') ? <span key={i} className="text-indigo-400 font-semibold">{part}</span> : part
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!c.resolved_at && (
                      <div className="mt-3">
                        {replyingTo === c.id ? (
                          <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                            <MentionTextarea
                              value={replyContent}
                              onChange={setReplyContent}
                              onSubmit={() => handleReply(c.id)}
                              placeholder="Reply..."
                              className="text-xs"
                            />
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => { setReplyingTo(null); setReplyContent(''); }} className="text-[10px] font-semibold text-text-tertiary hover:text-text-primary px-2 py-1">Cancel</button>
                              <button onClick={() => handleReply(c.id)} disabled={submitting || !replyContent.trim()} className="text-[10px] font-semibold bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded disabled:opacity-50">Reply</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => { setReplyingTo(c.id); setReplyContent(''); }} className="text-[11px] font-semibold text-text-tertiary hover:text-text-primary flex items-center gap-1.5 px-2 py-1 -ml-2 rounded hover:bg-surface-3 transition-colors">
                            <MessageSquare className="w-3 h-3" /> Reply
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            }
            return null;
          })}
        </AnimatePresence>
      </div>

      <div className="bg-surface-elevated border border-border rounded-xl p-3 shadow-sm ml-4 relative">
        <div className="absolute -left-[29px] top-4 w-6 h-6 rounded-full bg-surface-2 border-2 border-surface-3 flex items-center justify-center">
          <User className="w-3 h-3 text-text-tertiary" />
        </div>
        <MentionTextarea
          value={newContent}
          onChange={setNewContent}
          onSubmit={handleSubmit}
          disabled={submitting}
          placeholder="Leave a comment or type @ to mention..."
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-[10px] font-mono text-text-quaternary flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Unified Timeline
          </span>
          <button
            onClick={handleSubmit}
            disabled={submitting || !newContent.trim()}
            className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold rounded shadow-sm disabled:opacity-50 transition-colors"
          >
            Comment
          </button>
        </div>
      </div>
    </div>
  );
}
