import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Icon } from '../ui/Icon';
import { RequirementCreationModal } from '../../pages/workspace/RequirementCreationModal';
import { RequirementDetailsModal } from '../../pages/workspace/RequirementDetailsModal';
import { PremiumLoader } from '../common/PremiumLoader';
import { PremiumEmptyState } from '../common/PremiumEmptyState';
import { useAuth } from '../../context/AuthContext';
import { User, Project } from '../../types';
import { FileText, Plus } from 'lucide-react';

export function ProjectRequirementsTab({ project }: { project: Project }) {
  const [requirements, setRequirements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<any | null>(null);

  const fetchRequirements = async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('requirements')
        .select('*')
        .eq('project_id', project.id)
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
  }, [project?.id]);

  return (
    <div className="flex flex-col h-full bg-transparent text-white overflow-hidden premium-fade-in-up p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Project Requirements</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Manage specifications for this project.</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="btn-premium-primary px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Requirement
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-premium pr-2">
        {loading ? (
          <PremiumLoader type="card" count={3} label="Syncing Requirements..." />
        ) : requirements.length === 0 ? (
          <PremiumEmptyState
            icon={FileText}
            title="No Requirements"
            description="Start building out the project scope by adding formal requirements."
            actionLabel="Define Requirement"
            onAction={() => setIsCreateModalOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {requirements.map(req => (
              <div 
                key={req.id} 
                onClick={() => setSelectedRequirement(req)}
                className="card-premium hover-lift p-4 cursor-pointer flex flex-col justify-between h-32 border border-border bg-surface-2 rounded-xl"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded
                    ${req.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                      req.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      req.priority === 'medium' ? 'bg-blue-500/20 text-blue-400' : 'bg-[var(--surface-glass)] text-[var(--text-muted)]'}`}>
                    {req.priority}
                  </span>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded
                    ${req.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' :
                      req.status === 'Under Review' ? 'bg-amber-500/20 text-amber-400' :
                      req.status === 'Converted' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-[var(--surface-glass)] text-[var(--text-muted)]'}`}>
                    {req.status}
                  </span>
                </div>
                <h3 className="font-semibold text-sm text-text-primary mb-1 truncate">{req.title}</h3>
                <div className="text-xs text-text-tertiary flex items-center gap-1.5 mt-auto">
                  <Icon name="calendar_today" size={12} />
                  {new Date(req.created_at).toLocaleDateString()}
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
          defaultProjectId={project.id}
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
