import React, { useState, useEffect } from 'react';
import { documentService, Document, DocumentVersion } from '../../services/documentService';
import { documentApprovalService } from '../../services/documentApprovalService';
import { VersionHistoryPanel } from './VersionHistoryPanel';
import { EntityAttachments } from '../files/EntityAttachments';
import { FileText, Save, History, CheckCircle, Share2, Lock, Edit2, PlayCircle, Eye, ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';

export function DocumentViewer({ documentId, onBack }: { documentId: string, onBack: () => void }) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [version, setVersion] = useState<DocumentVersion | null>(null);
  const [history, setHistory] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  
  const { workspace } = useWorkspace();
  const { profile } = useAuth();

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  const loadDocument = async () => {
    setLoading(true);
    const result = await documentService.getDocument(documentId);
    if (result) {
      setDoc(result.document);
      setVersion(result.currentVersion);
      setEditContent(result.currentVersion?.content || '');
    }
    const h = await documentService.getVersionHistory(documentId);
    setHistory(h);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!doc) return;
    const newVer = await documentService.createVersion(documentId, editContent, 'Manual edit');
    if (newVer) {
      setVersion(newVer);
      setIsEditing(false);
      loadDocument();
    }
  };

  const handleRequestApproval = async () => {
    if (!doc || !version || !workspace) return;
    await documentApprovalService.requestApproval(documentId, version.id, workspace.id, [doc.owner_id], 'Please approve this version');
    loadDocument();
  };

  const handleRestore = async (v: DocumentVersion) => {
    await documentService.createVersion(documentId, v.content, `Restored from version ${v.version_number}`);
    loadDocument();
    setShowHistory(false);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[var(--pm-text-secondary)]">
        <ShieldAlert className="w-10 h-10 mb-4 opacity-50" />
        <p>Document not found or access denied.</p>
        <button onClick={onBack} className="mt-4 text-indigo-500">Go Back</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border bg-surface-2">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-surface-3 rounded-md text-[var(--pm-text-secondary)] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[var(--pm-text)] text-[var(--text-primary)]">{doc.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-[var(--pm-text-secondary)]">
              <span className="capitalize">{doc.document_type}</span>
              <span>•</span>
              <span className={`capitalize font-medium ${
                doc.status === 'approved' ? 'text-emerald-500' :
                doc.status === 'review' ? 'text-amber-500' : ''
              }`}>{doc.status}</span>
              <span>•</span>
              <span>v{version?.version_number}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => setShowHistory(true)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--pm-text-secondary)] bg-surface hover:bg-surface-3 border border-border rounded-lg transition-colors">
            <History className="w-4 h-4" /> History
          </button>
          
          {doc.status !== 'approved' && !isEditing && (
            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg transition-colors">
              <Edit2 className="w-4 h-4" /> Edit
            </button>
          )}

          {isEditing && (
            <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg shadow-sm transition-colors">
              <Save className="w-4 h-4" /> Save Version
            </button>
          )}

          {doc.status === 'draft' && !isEditing && (
            <button onClick={handleRequestApproval} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg shadow-sm transition-colors">
              <CheckCircle className="w-4 h-4" /> Request Approval
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
        {version?.is_locked && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-700">
            <Lock className="w-5 h-5" />
            <span className="text-sm font-medium">This version is locked and approved. Edits will create a new version.</span>
          </div>
        )}

        {isEditing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-[60vh] p-6 bg-surface border border-border rounded-xl text-[var(--pm-text)] text-[var(--text-primary)] focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono text-sm leading-relaxed"
            placeholder="Document content..."
          />
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none bg-surface p-8 rounded-xl border border-border shadow-sm min-h-[60vh]">
            {version?.content ? (
              <div dangerouslySetInnerHTML={{ __html: version.content.replace(/\n/g, '<br/>') }} />
            ) : (
              <p className="text-[var(--pm-text-secondary)] italic">No content available.</p>
            )}
          </div>
        )}

        {/* Attachments Section */}
        {workspace && (
          <div className="mt-8 border-t border-border pt-6">
            <EntityAttachments
              workspaceId={workspace.id}
              entityType="document"
              entityId={documentId}
              readOnly={isEditing} // Hide upload while editing
            />
          </div>
        )}
      </div>

      <VersionHistoryPanel 
        isOpen={showHistory} 
        onClose={() => setShowHistory(false)} 
        versions={history} 
        currentVersionId={version?.id}
        onRestore={handleRestore}
      />
    </div>
  );
}
