import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Icon } from '../../components/ui/Icon';
import { DocumentCreationModal } from './DocumentCreationModal';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { PremiumLoader } from '../../components/common/PremiumLoader';
import { PremiumEmptyState } from '../../components/ui/PremiumEmptyState';
import { Link2, Plus } from 'lucide-react';

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
      case 'figma': return <div className="text-pink-400"><Icon name="draw" size={24} /></div>;
      case 'github': return <div className="text-[var(--text-muted)]"><Icon name="code" size={24} /></div>;
      default: return <div className="text-indigo-400"><Icon name="link" size={24} /></div>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent text-white overflow-hidden premium-fade-in-up">
      <div className="flex-none p-6 border-b border-[var(--border-soft)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Document References</h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Centralize your external resources and links.</p>
          </div>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="btn-premium-primary px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Reference
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto scrollbar-premium">
        {loading ? (
          <PremiumLoader type="card" count={8} label="Syncing document index..." />
        ) : documents.length === 0 ? (
          <div className="max-w-md mx-auto mt-12">
            <PremiumEmptyState
              icon={Link2}
              title="No Documents Connected"
              description="Keep your design files, specs, code repositories, and external resources organized in a single unified index."
              action={
                <button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="btn-premium-primary px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Connect Reference
                </button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {documents.map(doc => (
              <a 
                key={doc.id} 
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card-premium hover-lift p-5 flex flex-col justify-between group h-36"
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
