import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/ui/Icon';
import { RequirementCreationModal } from './RequirementCreationModal';
import { RequirementDetailsModal } from './RequirementDetailsModal';
import { PremiumLoader } from '../../components/common/PremiumLoader';
import { PremiumEmptyState } from '../../components/ui/PremiumEmptyState';
import { FileText, Plus } from 'lucide-react';

export default function RequirementsPage() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const [requirements, setRequirements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<any | null>(null);

  const fetchRequirements = async () => {
    if (!workspace?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('requirements')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        setRequirements(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequirements();
  }, [workspace?.id]);

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent text-white overflow-hidden premium-fade-in-up">
      <div className="flex-none p-6 border-b border-[var(--border-soft)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Requirements</h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Manage client and internal project requirements.</p>
          </div>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="btn-premium-primary px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Requirement
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto scrollbar-premium">
        {loading ? (
          <PremiumLoader type="card" count={6} label="Syncing Requirements..." />
        ) : requirements.length === 0 ? (
          <div className="max-w-md mx-auto mt-12">
            <PremiumEmptyState
              icon={FileText}
              title="No Requirements Registered"
              description="This module tracks project scope and technical parameters, ensuring alignment between client specifications and engineering tasks."
              action={
                <button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="btn-premium-primary px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Register Requirement
                </button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {requirements.map(req => (
              <div 
                key={req.id} 
                onClick={() => setSelectedRequirement(req)}
                className="card-premium hover-lift p-5 cursor-pointer flex flex-col justify-between h-40"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={`text-[10px] uppercase tracking-wider font-mono px-2 py-1 rounded
                    ${req.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                      req.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      req.priority === 'medium' ? 'bg-blue-500/20 text-blue-400' : 'bg-[var(--surface-glass)] text-[var(--text-muted)]'}`}>
                    {req.priority}
                  </span>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded
                    ${req.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' :
                      req.status === 'Under Review' ? 'bg-amber-500/20 text-amber-400' :
                      req.status === 'Converted' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-[var(--surface-glass)] text-[var(--text-muted)]'}`}>
                    {req.status}
                  </span>
                </div>
                <h3 className="font-semibold text-lg mb-2">{req.title}</h3>
                <div className="space-y-2 text-sm text-[var(--text-muted)]">
                  <div className="flex items-center gap-2">
                    <Icon name="calendar_today" size={14} />
                    {new Date(req.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {isCreateModalOpen && (
        <RequirementCreationModal 
          onClose={() => setIsCreateModalOpen(false)} 
          onSuccess={() => { setIsCreateModalOpen(false); fetchRequirements(); }} 
        />
      )}

      {selectedRequirement && (
        <RequirementDetailsModal 
          requirement={selectedRequirement} 
          onClose={() => setSelectedRequirement(null)}
          onUpdate={fetchRequirements}
        />
      )}
    </div>
  );
}
