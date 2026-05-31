import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchDocuments, searchDocuments, createDocument, togglePinDocument, deleteDocument,
  fetchArchivedDocuments, restoreDocument, supportsSoftDelete,
  Document,
} from '../../services/documentService';
import { activityLogService } from '../../services/activityLogService';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, Search, Plus, FileText, Clock, Archive, Pin, Trash2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
    <div className="p-6 md:p-10 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 border-b border-border/40 pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-accent-primary/20 flex items-center justify-center border border-accent-primary/30">
              <BookOpen className="w-5 h-5 text-accent-primary" />
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-text-primary">Knowledge Hub</h2>
          </div>
          <p className="text-sm font-medium text-text-tertiary">
            Centralized intelligence, markdown documentation, and architectural blueprints.
          </p>
        </div>
        
        {/* Search + Create */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input type="text" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={tab === 'active' ? 'Search documents...' : 'Filter archived...'}
              className="w-full bg-surface-2 border border-border/50 h-10 pl-10 pr-4 rounded-lg text-sm font-medium text-text-primary placeholder:text-text-quaternary focus:border-accent-primary/60 focus:bg-surface-3 outline-none transition-all shadow-inner" />
          </div>
          {tab === 'active' && (
            <button onClick={() => setShowCreate(true)}
              className="h-10 px-4 bg-accent-primary hover:bg-accent-primary/90 text-[var(--pm-text)] dark:text-white rounded-lg text-sm font-semibold tracking-wide transition-all shadow-[0_0_15px_rgba(var(--color-accent-primary-rgb),0.2)] hover:shadow-[0_0_20px_rgba(var(--color-accent-primary-rgb),0.4)] flex items-center gap-2 whitespace-nowrap">
              <Plus className="w-4 h-4" /> New Doc
            </button>
          )}
        </div>
      </div>

      {/* Active / Archived tabs */}
      <div className="flex gap-6 mb-8 border-b border-border/40">
        <button onClick={() => switchTab('active')}
          className={`pb-3 text-sm font-semibold uppercase tracking-wider transition-all relative ${
            tab === 'active' ? 'text-accent-primary' : 'text-text-tertiary hover:text-text-primary'
          }`}>
          Active Documents
          {tab === 'active' && (
            <motion.div layoutId="knowledgetab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary shadow-[0_0_10px_rgba(var(--color-accent-primary-rgb),1)]" />
          )}
        </button>
        <button onClick={() => switchTab('archived')}
          className={`pb-3 text-sm font-semibold uppercase tracking-wider transition-all relative ${
            tab === 'archived' ? 'text-accent-primary' : 'text-text-tertiary hover:text-text-primary'
          }`}>
          Archived Base
          {tab === 'archived' && (
            <motion.div layoutId="knowledgetab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary shadow-[0_0_10px_rgba(var(--color-accent-primary-rgb),1)]" />
          )}
        </button>
      </div>

      <AnimatePresence>
        {/* Create form */}
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
            className="border border-border/50 bg-surface-2/40 backdrop-blur-md p-6 rounded-2xl mb-8 shadow-lg"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-text-secondary flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Draft New Document
              </h3>
            </div>
            <input type="text" value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Document title"
              className="w-full bg-surface-3 border border-border/50 p-3 rounded-lg text-sm font-medium text-text-primary placeholder:text-text-quaternary focus:border-accent-primary/60 outline-none transition-all shadow-inner mb-4" />
            <textarea value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="Markdown Content (optional)"
              rows={6}
              className="w-full bg-surface-3 border border-border/50 p-3 rounded-lg text-sm font-mono text-text-primary placeholder:text-text-quaternary focus:border-accent-primary/60 outline-none transition-all shadow-inner resize-y mb-6" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)}
                className="px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-text-tertiary hover:text-text-primary hover:bg-[var(--pm-surface)]/5 rounded-lg transition-all">
                Discard
              </button>
              <button onClick={handleCreate}
                className="px-6 py-2.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-sm font-semibold uppercase tracking-wide hover:bg-emerald-600/30 rounded-lg transition-all shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                Publish Document
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full" />
        </div>
      ) : docs.length === 0 ? (
        <div className="border border-dashed border-border/40 bg-surface-2/20 rounded-2xl p-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-surface-3 flex items-center justify-center mb-4">
            {tab === 'archived' ? <Archive className="w-8 h-8 text-text-quaternary" /> : <FileText className="w-8 h-8 text-text-quaternary" />}
          </div>
          <span className="text-base font-medium text-text-secondary">
            {tab === 'archived' ? 'Archive is empty' : (searchQuery ? 'No matching documents found' : 'No documents in the hub')}
          </span>
          <span className="text-sm text-text-tertiary mt-2">
            {tab === 'archived' ? 'Deleted documents will be retained here' : (searchQuery ? 'Try broadening your search query' : 'Initialize the knowledge base by creating your first document')}
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {docs.map(doc => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={doc.id}
                className="group border border-border/50 bg-surface-2/30 hover:bg-surface-3/50 backdrop-blur-sm p-5 rounded-2xl flex flex-col justify-between transition-all hover:border-accent-primary/40 hover:shadow-lg cursor-pointer h-40 relative overflow-hidden"
                onClick={() => tab === 'active' ? handleOpenDoc(doc.id) : undefined}>
                
                {doc.pinned && (
                  <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden">
                    <div className="absolute top-0 right-0 bg-signal-warning/20 text-signal-warning text-[10px] font-bold w-16 text-center rotate-45 transform origin-bottom-left pt-1 pb-1 shadow-sm">
                      PINNED
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-base font-semibold text-text-primary truncate pr-6 leading-tight mb-2 group-hover:text-accent-primary transition-colors">{doc.title}</h3>
                  <div className="flex items-center gap-2 text-xs font-medium text-text-tertiary">
                    <Clock className="w-3.5 h-3.5 opacity-70" />
                    {tab === 'archived'
                      ? `Deleted ${timeAgo(doc.deleted_at)}`
                      : `Updated ${timeAgo(doc.updated_at)}`}
                  </div>
                  {doc.tags?.length > 0 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-none">
                      {doc.tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 bg-[var(--pm-surface)]/5 border border-border/40 rounded text-[10px] font-medium text-text-secondary whitespace-nowrap">
                          {tag}
                        </span>
                      ))}
                      {doc.tags.length > 3 && <span className="px-2 py-0.5 text-[10px] text-text-quaternary">+{doc.tags.length - 3}</span>}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-end gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  {tab === 'active' ? (
                    <>
                      <button onClick={e => { e.stopPropagation(); handleTogglePin(doc.id, doc.pinned); }}
                        className={`p-2 rounded-lg transition-all ${doc.pinned ? 'bg-signal-warning/10 text-signal-warning hover:bg-signal-warning/20' : 'bg-surface-3 text-text-tertiary hover:bg-[var(--pm-surface)]/10 hover:text-text-primary'}`}
                        title={doc.pinned ? 'Unpin Document' : 'Pin Document'}>
                        <Pin className="w-4 h-4" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(doc.id); }}
                        className="p-2 bg-surface-3 text-text-tertiary hover:bg-signal-critical/10 hover:text-signal-critical rounded-lg transition-all"
                        title="Delete Document">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); handleRestore(doc.id); }}
                      className="px-3 py-1.5 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wide hover:bg-emerald-600/20 rounded-lg transition-all">
                      Restore Doc
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
