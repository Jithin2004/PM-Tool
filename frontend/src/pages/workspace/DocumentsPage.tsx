import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Icon } from '../../components/ui/Icon';
import { DocumentCreationModal } from './DocumentCreationModal';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';

export default function DocumentsPage() {
  const { workspace } = useWorkspace();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<any | null>(null);

  const fetchDocuments = async () => {
    if (!workspace?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('document_references')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        setDocuments(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;
    try {
      const { error } = await supabase.from('document_references').delete().eq('id', documentToDelete.id);
      if (!error) {
        fetchDocuments();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDocumentToDelete(null);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [workspace?.id]);

  const getIconForType = (type: string) => {
    switch (type) {
      case 'google_doc': return <div className="text-blue-400"><Icon name="description" size={24} /></div>;
      case 'drive': return <div className="text-green-400"><Icon name="folder_open" size={24} /></div>;
      case 'figma': return <div className="text-pink-400"><Icon name="draw" size={24} /></div>;
      case 'github': return <div className="text-[var(--text-muted)]"><Icon name="code" size={24} /></div>;
      default: return <div className="text-indigo-400"><Icon name="link" size={24} /></div>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111827] text-white overflow-hidden">
      <div className="flex-none p-6 border-b border-[var(--border-soft)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Document References</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">Centralize your external resources and links.</p>
          </div>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <Icon name="add_link" size={18} />
            Add Reference
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
            <Icon name="folder_off" size={48} className="mb-4 opacity-50" />
            <p>No document references yet. Keep your tools connected.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {documents.map(doc => (
              <a 
                key={doc.id} 
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded-xl p-5 hover:bg-[var(--surface-hover)] transition-colors flex flex-col group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getIconForType(doc.type)}
                    <h3 className="font-semibold text-sm truncate group-hover:text-indigo-300 transition-colors">{doc.title}</h3>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDocumentToDelete(doc);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                  >
                    <Icon name="delete" size={16} />
                  </button>
                </div>
                <div className="mt-auto pt-3 border-t border-[var(--border-soft)] text-xs text-[var(--text-muted)] truncate">
                  {doc.url}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
      
      {isCreateModalOpen && (
        <DocumentCreationModal 
          onClose={() => setIsCreateModalOpen(false)} 
          onSuccess={() => { setIsCreateModalOpen(false); fetchDocuments(); }} 
        />
      )}

      <ConfirmationModal
        isOpen={!!documentToDelete}
        title="Delete Document Reference"
        message={`Are you sure you want to remove the reference to "${documentToDelete?.title}"?`}
        confirmText="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDocumentToDelete(null)}
      />
    </div>
  );
}
