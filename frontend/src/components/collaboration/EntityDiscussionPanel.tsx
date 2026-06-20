import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { commentService, EntityComment } from '../../services/commentService';
import { MentionTextarea } from './MentionTextarea';
import { MessageSquare, MoreHorizontal, CheckCircle2, CornerDownRight, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { slideUp } from '../../lib/animation';

interface EntityDiscussionPanelProps {
  entityType: string;
  entityId: string;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function EntityDiscussionPanel({ entityType, entityId }: EntityDiscussionPanelProps) {
  const { user, profile } = useAuth();
  const { workspace } = useWorkspace();
  const [comments, setComments] = useState<EntityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const loadComments = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    const data = await commentService.getEntityComments(entityType, entityId);
    setComments(data);
    setLoading(false);
  };

  useEffect(() => {
    loadComments();
  }, [entityType, entityId, workspace?.id]);

  const handleSubmit = async () => {
    if (!newContent.trim() || !workspace?.id || !user?.id || submitting) return;
    setSubmitting(true);
    const authorName = profile?.full_name || user.email?.split('@')[0] || 'Unknown';
    const c = await commentService.createComment(workspace.id, entityType, entityId, user.id, authorName, newContent, null);
    if (c) {
      setComments(prev => [...prev, { ...c, replies: [], reactions: [], author_name: authorName }]);
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
      setComments(prev => prev.map(p => {
        if (p.id === parentId) {
          return { ...p, replies: [...(p.replies || []), { ...c, author_name: authorName, replies: [], reactions: [] }] };
        }
        return p;
      }));
      setReplyingTo(null);
      setReplyContent('');
    }
    setSubmitting(false);
  };

  const toggleReaction = async (commentId: string, emoji: string, isParent: boolean, parentId?: string) => {
    if (!workspace?.id || !user?.id) return;
    
    // Optimistic UI could go here
    await commentService.addReaction(workspace.id, commentId, user.id, emoji);
    await loadComments(); // Simplest approach: reload
  };

  const resolveThread = async (commentId: string) => {
    if (!workspace?.id || !user?.id) return;
    await commentService.resolveComment(commentId, user.id, workspace.id, entityType, entityId);
    await loadComments();
  };

  if (loading) return <div className="animate-pulse h-20 bg-surface-2 rounded-lg"></div>;

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <AnimatePresence>
          {comments.map(c => (
            <motion.div key={c.id} variants={slideUp} initial="hidden" animate="visible" className={`p-4 rounded-xl border ${c.resolved_at ? 'bg-surface-1 border-border-subtle opacity-70' : 'bg-surface-2 border-border'}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs uppercase">
                    {c.author_name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-text-primary flex items-center gap-2">
                      {c.author_name}
                      <span className="text-[10px] text-text-tertiary font-normal">{timeAgo(c.created_at)}</span>
                    </div>
                  </div>
                </div>
                {!c.resolved_at && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleReaction(c.id, '👍', true)} className="text-text-tertiary hover:text-text-primary p-1 rounded hover:bg-surface-hover"><Smile className="w-3.5 h-3.5" /></button>
                    <button onClick={() => resolveThread(c.id)} title="Resolve Thread" className="text-text-tertiary hover:text-emerald-400 p-1 rounded hover:bg-surface-hover"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
                {c.resolved_at && (
                  <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Resolved
                  </span>
                )}
              </div>
              
              <div className="text-sm text-text-secondary pl-8 whitespace-pre-wrap leading-relaxed">
                {/* Basic mention highlight rendering (naively bolding @mentions) */}
                {c.content.split(/(@[a-zA-Z0-9_.-]+)/g).map((part, i) => 
                  part.startsWith('@') ? <span key={i} className="text-indigo-400 font-semibold">{part}</span> : part
                )}
              </div>

              {c.reactions && c.reactions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 pl-8">
                  {/* Group reactions by emoji */}
                  {Object.entries(c.reactions.reduce((acc, r) => { acc[r.emoji] = (acc[r.emoji]||0)+1; return acc; }, {} as Record<string,number>)).map(([emoji, count]) => (
                    <span key={emoji} className="text-[10px] bg-surface-3 border border-border px-1.5 py-0.5 rounded-full flex items-center gap-1 cursor-default">
                      {emoji} <span className="opacity-70">{count}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Replies */}
              {c.replies && c.replies.length > 0 && (
                <div className="mt-3 pl-8 space-y-3">
                  {c.replies.map(reply => (
                    <div key={reply.id} className="pt-3 border-t border-border-subtle relative">
                      <CornerDownRight className="w-3 h-3 absolute -left-4 top-4 text-border" />
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded-full bg-surface-3 flex items-center justify-center font-bold text-[10px] uppercase text-text-secondary">
                          {reply.author_name?.charAt(0) || '?'}
                        </div>
                        <span className="text-xs font-semibold text-text-primary">{reply.author_name}</span>
                        <span className="text-[10px] text-text-tertiary">{timeAgo(reply.created_at)}</span>
                      </div>
                      <div className="text-xs text-text-secondary pl-7 whitespace-pre-wrap">
                        {reply.content.split(/(@[a-zA-Z0-9_.-]+)/g).map((part, i) => 
                          part.startsWith('@') ? <span key={i} className="text-indigo-400 font-semibold">{part}</span> : part
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!c.resolved_at && (
                <div className="pl-8 mt-3">
                  {replyingTo === c.id ? (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                      <MentionTextarea
                        value={replyContent}
                        onChange={setReplyContent}
                        onSubmit={() => handleReply(c.id)}
                        placeholder="Reply to thread..."
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
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="bg-surface-elevated border border-border rounded-xl p-3 shadow-sm">
        <MentionTextarea
          value={newContent}
          onChange={setNewContent}
          onSubmit={handleSubmit}
          disabled={submitting}
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-[10px] font-mono text-text-quaternary flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Markdown & @mentions supported
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
