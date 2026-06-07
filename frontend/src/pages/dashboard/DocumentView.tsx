import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  fetchDocument, updateDocument, createVersion,
  fetchVersions, fetchAnnotations, createAnnotation, resolveAnnotation,
  Document, DocVersion, DocAnnotation,
} from '../../services/documentService';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { activityLogService } from '../../services/activityLogService';

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function DocumentView() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const wsId = workspace?.id || '';

  // Extract docId from URL
  const docId = window.location.pathname.replace('/workspace/knowledge/', '').split('/')[0];

  const [doc, setDoc] = useState<Document | null>(null);
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [annotations, setAnnotations] = useState<DocAnnotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [tab, setTab] = useState<'view' | 'history' | 'annotations'>('view');
  const [showVersionComment, setShowVersionComment] = useState(false);
  const [versionSummary, setVersionSummary] = useState('');
  const [selStart, setSelStart] = useState(0);
  const [selEnd, setSelEnd] = useState(0);
  const [selText, setSelText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const loadDoc = useCallback(async () => {
    if (!docId || docId === 'undefined') { setLoading(false); return; }
    const [d, v, a] = await Promise.all([
      fetchDocument(docId), fetchVersions(docId), fetchAnnotations(docId),
    ]);
    setDoc(d);
    setVersions(v);
    setAnnotations(a);
    setEditContent(d?.content || '');
    setEditTitle(d?.title || '');
    setLoading(false);
  }, [docId]);

  useEffect(() => { loadDoc(); }, [loadDoc]);

  const handleSave = async () => {
    if (!doc || !wsId) return;
    setIsSaving(true);
    const success = await updateDocument(doc.id, {
      title: editTitle, content: editContent, author_id: profile?.id,
    });
    if (success) {
      await activityLogService.appendLog({
        workspace_id: wsId, actor_id: profile?.id, action: 'document_updated',
        metadata: { doc_id: doc.id, title: editTitle },
      });
      setEditing(false);
      await loadDoc();
    }
    setIsSaving(false);
  };

  const handleCreateVersion = async () => {
    if (!doc) return;
    await createVersion(doc.id, doc.content, profile?.id, versionSummary || undefined);
    setShowVersionComment(false);
    setVersionSummary('');
    await loadDoc();
  };

  const handleTextSelect = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !contentRef.current?.contains(sel.anchorNode)) return;
    const fullText = contentRef.current.textContent || '';
    const selectedText = sel.toString();
    const start = fullText.indexOf(selectedText);
    if (start < 0) return;
    setSelStart(start);
    setSelEnd(start + selectedText.length);
    setSelText(selectedText);
  };

  const handleAddAnnotation = async () => {
    if (!doc || !commentText.trim() || selStart === selEnd) return;
    const ann = await createAnnotation({
      doc_id: doc.id, author_id: profile?.id,
      selection_start: selStart, selection_end: selEnd,
      comment: commentText,
    });
    if (ann) {
      setCommentText('');
      setSelText('');
      await loadDoc();
    }
  };

  const handleResolveAnnotation = async (annId: string) => {
    await resolveAnnotation(annId);
    await loadDoc();
  };

  const handleBack = () => {
    window.history.pushState(null, '', '/workspace/knowledge');
    window.dispatchEvent(new CustomEvent('popstate'));
  };

  if (loading) return (
    <div className="p-6">
      <div className="text-[11px] font-mono text-text-quaternary"><span className="animate-pulse tracking-widest uppercase text-[10px] font-mono text-[var(--text-muted)]">Loading Document...</span></div>
    </div>
  );

  if (!doc) return (
    <div className="p-6">
      <button onClick={handleBack} className="text-[10px] font-medium text-signal-info hover:text-blue-300 mb-4">&larr; Back to Knowledge Hub</button>
      <div className="border border-border bg-surface-3 p-12 text-center">
        <span className="text-[11px] font-mono text-text-quaternary">Document not found</span>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={handleBack} className="text-[10px] font-medium text-signal-info hover:text-blue-300">&larr; Knowledge Hub</button>
        <span className="text-text-quaternary">/</span>
        <span className="text-[10px] font-mono text-text-tertiary truncate">{doc.title}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border pb-3 mb-4">
        {(['view', 'history', 'annotations'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-[10px] font-mono uppercase tracking-wider ${tab === t ? 'text-text-primary border-b-2 border-[var(--border-soft)] pb-3' : 'text-text-quaternary hover:text-text-tertiary'}`}>
            {t === 'view' ? 'Document' : t === 'history' ? `History (${versions.length})` : `Annotations (${annotations.filter(a => !a.resolved).length})`}
          </button>
        ))}
      </div>

      {/* ── View / Edit Tab ── */}
      {tab === 'view' && (
        <div>
          {/* Title bar */}
          <div className="flex items-center justify-between mb-4">
            {editing ? (
              <input type="text" value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="flex-1 bg-bg border border-border p-2 text-sm font-mono text-text-primary focus:border-border focus:outline-none" />
            ) : (
              <div>
                <h1 className="text-sm font-sans tracking-tight text-text-primary">{doc.title}</h1>
                <div className="text-[9px] font-mono text-text-quaternary mt-1">
                  Updated {timeAgo(doc.updated_at)}
                  {doc.pinned && <span className="text-signal-warning ml-2">📌 Pinned</span>}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 shrink-0 ml-3">
              {editing ? (
                <>
                  <button onClick={handleSave} disabled={isSaving}
                    className="px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-[9px] font-medium uppercase tracking-wider hover:bg-emerald-600/30 disabled:opacity-30">
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => { setEditing(false); setEditContent(doc.content); setEditTitle(doc.title); }}
                    className="px-3 py-1.5 text-text-quaternary hover:text-text-tertiary text-[9px] font-mono">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditing(true)}
                    className="px-3 py-1.5 bg-surface-3 border border-border text-signal-info text-[9px] font-mono uppercase tracking-wider hover:bg-surface-3">
                    Edit
                  </button>
                  <button onClick={() => setShowVersionComment(true)}
                    className="px-3 py-1.5 bg-[var(--pm-surface)]/5 border border-border text-text-tertiary text-[9px] font-mono hover:border-[var(--border-soft)]">
                    Create Version
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Version comment input */}
          {showVersionComment && (
            <div className="border border-border bg-surface-3 p-3 mb-4">
              <input type="text" value={versionSummary}
                onChange={e => setVersionSummary(e.target.value)}
                placeholder="Change summary (optional)"
                className="w-full bg-bg border border-border p-2 text-[11px] font-mono text-text-primary placeholder-white/20 focus:border-border focus:outline-none mb-2" />
              <div className="flex gap-2">
                <button onClick={handleCreateVersion}
                  className="px-3 py-1.5 bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 text-[9px] font-medium uppercase tracking-wider">
                  Create Snapshot
                </button>
                <button onClick={() => setShowVersionComment(false)}
                  className="px-3 py-1.5 text-text-quaternary hover:text-text-tertiary text-[9px] font-mono">Cancel</button>
              </div>
            </div>
          )}

          {/* Content */}
          {editing ? (
            <textarea value={editContent}
              onChange={e => setEditContent(e.target.value)}
              onMouseUp={handleTextSelect}
              ref={contentRef as any}
              rows={20}
              className="w-full bg-bg border border-border p-4 text-[11px] font-mono text-text-secondary leading-relaxed focus:border-border focus:outline-none resize-none" />
          ) : (
            <div ref={contentRef} onMouseUp={handleTextSelect}
              className="border border-border bg-bg p-4 text-[11px] font-mono text-text-secondary leading-relaxed whitespace-pre-wrap min-h-[300px]">
              {doc.content || <span className="text-text-quaternary italic">No content</span>}
            </div>
          )}

          {/* Annotate selection */}
          {selText && (
            <div className="border border-border bg-signal-warning-bg p-3 mt-4">
              <div className="text-[9px] font-mono text-signal-warning/80 mb-1">Selected: &ldquo;{selText.slice(0, 100)}&rdquo;</div>
              <textarea value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Add annotation comment..."
                rows={2}
                className="w-full bg-bg border border-border p-2 text-[11px] font-mono text-text-primary placeholder-white/20 focus:border-border focus:outline-none resize-none mb-2" />
              <button onClick={handleAddAnnotation}
                className="px-3 py-1.5 bg-signal-warning-bg border border-border text-signal-warning text-[9px] font-medium uppercase tracking-wider hover:bg-signal-warning-bg">
                Add Annotation
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── History Tab ── */}
      {tab === 'history' && (
        <div>
          {versions.length === 0 ? (
            <div className="border border-border bg-surface-3 p-8 text-center">
              <span className="text-[10px] font-mono text-text-quaternary">No version history yet</span>
            </div>
          ) : (
            <div className="space-y-1">
              {versions.map(v => (
                <div key={v.id} className="border border-border bg-surface-3 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono text-text-secondary">v{v.version}</span>
                      <span className="text-[9px] font-mono text-text-quaternary ml-3">{timeAgo(v.created_at)}</span>
                    </div>
                    <span className="text-[9px] font-mono text-text-quaternary">Hash: {v.hash.slice(0, 12)}...</span>
                  </div>
                  {v.change_summary && (
                    <div className="text-[9px] font-mono text-text-quaternary mt-1">{v.change_summary}</div>
                  )}
                  {v.author_id && (
                    <div className="text-[8px] font-mono text-text-quaternary mt-1">Author: {v.author_id}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Annotations Tab ── */}
      {tab === 'annotations' && (
        <div>
          {annotations.length === 0 ? (
            <div className="border border-border bg-surface-3 p-8 text-center">
              <span className="text-[10px] font-mono text-text-quaternary">No annotations yet</span>
              <span className="text-[8px] font-mono text-text-quaternary mt-1 block">Select text in the document and add a comment</span>
            </div>
          ) : (
            <div className="space-y-2">
              {annotations.map(a => (
                <div key={a.id} className={`border px-4 py-3 ${a.resolved ? 'border-emerald-500/10 bg-emerald-500/[0.01]' : 'border-border bg-amber-500/[0.02]'}`}>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] font-mono text-text-tertiary mb-1">
                        Selection [{a.selection_start}–{a.selection_end}]
                      </div>
                      <div className="text-[11px] font-mono text-text-secondary">{a.comment}</div>
                      <div className="text-[8px] font-mono text-text-quaternary mt-1">{timeAgo(a.created_at)}</div>
                    </div>
                    {!a.resolved && (
                      <button onClick={() => handleResolveAnnotation(a.id)}
                        className="px-2 py-1 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-[8px] font-mono hover:bg-emerald-600/30 shrink-0 ml-2">
                        Resolve
                      </button>
                    )}
                  </div>
                  {a.resolved && <div className="text-[8px] font-mono text-emerald-400/60 mt-1">Resolved</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
