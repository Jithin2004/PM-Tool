import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchDocuments, searchDocuments, createDocument, togglePinDocument, deleteDocument,
  fetchArchivedDocuments, restoreDocument, supportsSoftDelete,
  Document,
} from '../../services/documentService';
import { activityLogService } from '../../services/activityLogService';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';

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

export default function KnowledgeHubPanel() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const wsId = workspace?.id || '';
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [sdSupported, setSdSupported] = useState(false);

  useEffect(() => {
    supportsSoftDelete().then(setSdSupported);
  }, []);

  const loadDocs = useCallback(async () => {
    if (!wsId) return;
    if (tab === 'archived') {
      const data = searchQuery.trim()
        ? (await fetchArchivedDocuments(wsId)).filter(d =>
            d.title.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : await fetchArchivedDocuments(wsId);
      setDocs(data);
      activityLogService.logDocumentArchivedViewed(wsId, profile?.id, data.length);
    } else {
      const data = searchQuery.trim()
        ? await searchDocuments(wsId, searchQuery)
        : await fetchDocuments(wsId);
      setDocs(data);
    }
    setLoading(false);
  }, [wsId, searchQuery, tab, profile?.id]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !wsId) return;
    const doc = await createDocument({
      workspace_id: wsId, author_id: profile?.id,
      title: newTitle, content: newContent, doc_type: 'markdown',
    });
    if (doc) {
      setNewTitle('');
      setNewContent('');
      setShowCreate(false);
      await loadDocs();
    }
  };

  const handleTogglePin = async (docId: string, pinned: boolean) => {
    await togglePinDocument(docId, !pinned);
    await loadDocs();
  };

  const handleDelete = async (docId: string) => {
    await deleteDocument(docId, profile?.id);
    await loadDocs();
  };

  const handleRestore = async (docId: string) => {
    await restoreDocument(docId, profile?.id);
    await loadDocs();
  };

  const handleOpenDoc = (docId: string) => {
    window.history.pushState(null, '', `/workspace/knowledge/${docId}`);
    window.dispatchEvent(new CustomEvent('popstate'));
  };

  const switchTab = (t: 'active' | 'archived') => {
    setTab(t);
    setSearchQuery('');
    setLoading(true);
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-[10px] font-mono uppercase tracking-wide text-text-quaternary">WORKSPACE</span>
        <span className="text-text-quaternary">/</span>
        <span className="text-xs font-mono text-text-secondary">Knowledge Hub</span>
      </div>

      {/* Search + Create */}
      <div className="flex items-center gap-3 mb-4">
        <input type="text" value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={tab === 'active' ? 'Search documents...' : 'Filter archived documents...'}
          className="flex-1 bg-bg border border-border p-2 text-[11px] font-mono text-text-primary placeholder-white/20 focus:border-border focus:outline-none transition-colors" />
        {tab === 'active' && (
          <button onClick={() => setShowCreate(true)}
            className="px-3 py-2 bg-surface-3 border border-border text-signal-info text-[9px] font-mono uppercase tracking-wider hover:bg-surface-3 transition-colors">
            New Doc
          </button>
        )}
      </div>

      {/* Active / Archived tabs */}
      <div className="flex gap-4 mb-4 border-b border-border">
        <button onClick={() => switchTab('active')}
          className={`pb-2 text-[10px] font-mono uppercase tracking-wider transition-colors ${
            tab === 'active' ? 'text-text-primary border-b-2 border-white' : 'text-text-quaternary hover:text-text-tertiary'
          }`}>
          Active
        </button>
        <button onClick={() => switchTab('archived')}
          className={`pb-2 text-[10px] font-mono uppercase tracking-wider transition-colors ${
            tab === 'archived' ? 'text-text-primary border-b-2 border-white' : 'text-text-quaternary hover:text-text-tertiary'
          }`}>
          Archived
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="border border-border bg-surface-3 p-4 mb-4">
          <input type="text" value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Document title"
            className="w-full bg-bg border border-border p-2 text-[11px] font-mono text-text-primary placeholder-white/20 focus:border-border focus:outline-none transition-colors mb-2" />
          <textarea value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="Content (optional)"
            rows={4}
            className="w-full bg-bg border border-border p-2 text-[11px] font-mono text-text-primary placeholder-white/20 focus:border-border focus:outline-none transition-colors resize-none mb-2" />
          <div className="flex gap-2">
            <button onClick={handleCreate}
              className="px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-[9px] font-medium uppercase tracking-wider hover:bg-emerald-600/30 transition-colors">
              Create
            </button>
            <button onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 text-text-quaternary hover:text-text-tertiary text-[9px] font-mono">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div className="text-[11px] font-mono text-text-quaternary">Loading documents...</div>
      ) : docs.length === 0 ? (
        <div className="border border-border bg-surface-3 p-12 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-mono text-text-quaternary uppercase tracking-wider">
            {tab === 'archived' ? 'No archived documents' : (searchQuery ? 'No documents match your search' : 'No documents yet')}
          </span>
          <span className="text-[9px] font-mono text-text-quaternary mt-2">
            {tab === 'archived' ? 'Deleted documents will appear here' : (searchQuery ? 'Try a different search term' : 'Create your first document')}
          </span>
        </div>
      ) : (
        <div className="space-y-1">
          {docs.map(doc => (
            <div key={doc.id}
              className="border border-border bg-surface-3 px-4 py-3 flex items-center justify-between hover:border-border transition-colors"
              onClick={() => tab === 'active' ? handleOpenDoc(doc.id) : undefined}>
              <div className="flex items-center gap-3 min-w-0">
                {doc.pinned && <span className="text-[9px] text-signal-warning shrink-0">📌</span>}
                <div className="min-w-0">
                  <div className="text-xs font-mono text-text-secondary truncate">{doc.title}</div>
                  <div className="text-[9px] font-mono text-text-quaternary mt-0.5">
                    {tab === 'archived'
                      ? `Deleted ${timeAgo(doc.deleted_at)}`
                      : timeAgo(doc.updated_at)}
                    {doc.tags?.length > 0 && ` · ${doc.tags.join(', ')}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-3">
                {tab === 'active' ? (
                  <>
                    <button onClick={e => { e.stopPropagation(); handleTogglePin(doc.id, doc.pinned); }}
                      className={`text-[9px] font-mono px-2 py-1 border ${doc.pinned ? 'border-border text-signal-warning' : 'border-border text-text-quaternary'} hover:border-white/30 transition-colors`}>
                      {doc.pinned ? 'Pinned' : 'Pin'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(doc.id); }}
                      className="text-[9px] font-mono px-2 py-1 border border-red-500/20 text-signal-critical/60 hover:border-red-500/40 transition-colors">
                      Delete
                    </button>
                  </>
                ) : (
                  <button onClick={e => { e.stopPropagation(); handleRestore(doc.id); }}
                    className="text-[9px] font-mono px-2 py-1 border border-emerald-500/20 text-emerald-400/60 hover:border-emerald-500/40 transition-colors">
                    Restore
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
