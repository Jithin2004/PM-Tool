import React, { useState, useEffect } from 'react';
import { documentService, Document } from '../../services/documentService';
import { useWorkspace } from '../../context/WorkspaceContext';
import { FileText, Search, Plus, Filter, Clock, MoreVertical, ShieldAlert, AlertCircle, RefreshCw, Flag } from 'lucide-react';
import { DocumentViewer } from '../../components/documents/DocumentViewer';
import { getRelativeTime } from '../../utils/timeUtils';
import { issueReportService } from '../../services/issueReportService';
import { showAlert } from '../../components/common/Dialogs';
import { PremiumEmptyState } from '../../components/ui/PremiumEmptyState';

export default function DocumentsCenter() {
  const { workspace } = useWorkspace();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isReporting, setIsReporting] = useState(false);

  useEffect(() => {
    if (workspace?.id) {
      loadDocuments();
    }
  }, [workspace?.id]);

  const loadDocuments = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const docs = await documentService.getWorkspaceDocuments(workspace.id);
      setDocuments(docs);
      setErrorMsg(null);
    } catch (err: any) {
      console.error(err);
      setDocuments([]);
      setErrorMsg(err?.message || 'Failed to load documents from server. Connection interrupted.');
    } finally {
      setLoading(false);
    }
  };

  const handleReportIssue = async () => {
    if (!workspace) return;
    setIsReporting(true);
    try {
      await issueReportService.createIssueReport({ workspaceId: workspace.id, userId: 'system', module: 'Documents Center', severity: 'high', title: 'Document Error', description: errorMsg || 'Unknown document fetch/network failure', browserMetadata: {
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString()
        } });
      await showAlert("Issue reported successfully to the workspace admin.", { type: "success" });
      setErrorMsg(null);
    } catch (err: any) {
      await showAlert(err.message || "Failed to report issue", { type: "error" });
    } finally {
      setIsReporting(false);
    }
  };

  const handleCreateDocument = async () => {
    if (!workspace) return;
    const newDoc = await documentService.createDocument(
      {
        workspace_id: workspace.id,
        title: 'Untitled Document',
        document_type: 'general',
        visibility: 'workspace',
        status: 'draft'
      },
      '# New Document\n\nStart typing here...'
    );
    if (newDoc) {
      setSelectedDocId(newDoc.id);
    }
  };

  const filteredDocs = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    doc.document_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedDocId) {
    return <DocumentViewer documentId={selectedDocId} onBack={() => { setSelectedDocId(null); loadDocuments(); }} />;
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-8 border-b border-border bg-surface-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--pm-text)] text-[var(--text-primary)] flex items-center gap-3">
            <FileText className="w-6 h-6 text-indigo-500" />
            Knowledge Base
          </h1>
          <p className="text-[var(--pm-text-secondary)] dark:text-[var(--pm-text-secondary)] mt-1">
            Company documents, requirements, and policies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--pm-text-secondary)]" />
            <input 
              type="text" 
              placeholder="Filter documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm text-[var(--pm-text)] w-64 focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
          <button className="p-2 border border-border bg-surface hover:bg-surface-3 rounded-lg text-[var(--pm-text-secondary)] transition-colors">
            <Filter className="w-4 h-4" />
          </button>
          <button onClick={handleCreateDocument} className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
            <Plus className="w-4 h-4" /> New Document
          </button>
        </div>
      </div>

      {/* Library Grid */}
      <div className="flex-1 overflow-y-auto p-8">
        {errorMsg && (
          <div className="mb-6 p-5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-rose-500">Document Connection Error</h3>
                <p className="text-xs text-rose-400 mt-1">{errorMsg}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button 
                onClick={loadDocuments} 
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--surface-hover)] border border-[var(--border-soft)] hover:bg-[var(--surface-active)] text-[var(--pm-text-secondary)] hover:text-white rounded-lg text-xs font-semibold transition-all w-full sm:w-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
              <button 
                onClick={handleReportIssue} 
                disabled={isReporting}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500/30 text-rose-400 hover:text-rose-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 w-full sm:w-auto"
              >
                <Flag className="w-3.5 h-3.5" /> {isReporting ? 'Reporting...' : 'Report Issue'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
        ) : filteredDocs.length === 0 ? (
          <div className="max-w-md mx-auto mt-12">
            <PremiumEmptyState
              icon={FileText}
              title="No documents yet"
              description="Store important project information, requirements, and meeting notes here."
              action={
                <button 
                  onClick={handleCreateDocument} 
                  className="btn-premium-primary px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 mx-auto"
                >
                  <Plus className="w-4 h-4" /> Create First Document
                </button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredDocs.map(doc => (
              <div 
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className="group bg-surface-2 border border-border hover:border-indigo-300 hover:shadow-md rounded-xl p-5 cursor-pointer transition-all flex flex-col h-48"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <button className="p-1 text-[var(--pm-text-secondary)] hover:bg-surface-3 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
                
                <h3 className="font-semibold text-[var(--pm-text)] text-[var(--text-primary)] truncate mb-1">{doc.title}</h3>
                
                <div className="flex items-center gap-2 text-xs font-medium mb-auto">
                  <span className="px-2 py-0.5 bg-surface border border-border rounded capitalize text-[var(--pm-text-secondary)]">
                    {doc.document_type}
                  </span>
                  <span className={`px-2 py-0.5 rounded capitalize ${
                    doc.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                    doc.status === 'review' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {doc.status}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50 text-xs text-[var(--pm-text-secondary)]">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {getRelativeTime(doc.updated_at)}
                  </div>
                  {doc.visibility === 'restricted' && <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
