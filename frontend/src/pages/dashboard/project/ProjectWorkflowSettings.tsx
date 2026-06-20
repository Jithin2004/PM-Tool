import React, { useState, useEffect } from 'react';
import { workflowService, WorkflowTemplate, WorkflowState } from '../../../services/workflowService';
import { workflowMigrationService, MigrationPreviewResult } from '../../../services/workflowMigrationService';
import { useAuth } from '../../../context/AuthContext';
import { useWorkspace } from '../../../context/WorkspaceContext';
import { Project } from '../../../types';
import { AlertTriangle, Settings2, ArrowRight } from 'lucide-react';
import { hasCapability } from '../../../core/auth/permissions';

interface ProjectWorkflowSettingsProps {
  project: Project;
  onWorkflowUpdated: () => void;
}

export const ProjectWorkflowSettings: React.FC<ProjectWorkflowSettingsProps> = ({ project, onWorkflowUpdated }) => {
  const { profile } = useAuth();
  const { workspace: currentWorkspace } = useWorkspace();
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(project.workflow_template_id || '');
  const [preview, setPreview] = useState<MigrationPreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  
  const [manualMappings, setManualMappings] = useState<Record<string, string>>({});
  const [newStates, setNewStates] = useState<WorkflowState[]>([]);

  const canManageWorkflow = hasCapability(profile?.role || 'viewer', 'manage_projects') || hasCapability(profile?.role || 'viewer', 'platform_governance');

  useEffect(() => {
    async function loadWorkflows() {
      if (currentWorkspace) {
        const templates = await workflowService.getAvailableWorkflows(currentWorkspace.id);
        setWorkflows(templates);
      }
    }
    loadWorkflows();
  }, [currentWorkspace]);

  useEffect(() => {
    async function loadPreview() {
      if (selectedWorkflowId && selectedWorkflowId !== project.workflow_template_id) {
        setLoading(true);
        const result = await workflowMigrationService.previewMigration(project.id, selectedWorkflowId);
        setPreview(result);
        
        const states = await workflowService.getWorkflowStates(selectedWorkflowId);
        setNewStates(states);
        setLoading(false);
      } else {
        setPreview(null);
        setNewStates([]);
      }
    }
    loadPreview();
  }, [selectedWorkflowId, project.id, project.workflow_template_id]);

  const handleApply = async () => {
    setApplying(true);
    // 1. Assign workflow to project
    await workflowService.assignWorkflowToProject(project.id, selectedWorkflowId);
    
    // 2. Apply manual migration if we have unmapped tasks (this is simplified)
    const mappingsArray = Object.entries(manualMappings).map(([oldStatus, newStateId]) => ({
      oldStatus,
      newWorkflowStateId: newStateId
    }));
    
    if (mappingsArray.length > 0) {
      await workflowMigrationService.applyManualMigration(project.id, mappingsArray);
    }
    
    setApplying(false);
    onWorkflowUpdated();
  };

  if (!canManageWorkflow) {
    return <div className="p-4 text-text-tertiary">You do not have permission to modify project workflows.</div>;
  }

  return (
    <div className="p-6 bg-surface-1 rounded-xl border border-border flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <Settings2 className="w-5 h-5 text-indigo-500" />
        <h2 className="text-lg font-semibold text-text-primary">Workflow Configuration</h2>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-text-secondary">Execution Workflow Template</label>
        <select 
          value={selectedWorkflowId}
          onChange={(e) => setSelectedWorkflowId(e.target.value)}
          className="p-2.5 bg-surface-2 border border-border rounded-lg text-text-primary"
        >
          <option value="">-- Select a Workflow --</option>
          {workflows.map(wf => (
            <option key={wf.id} value={wf.id}>{wf.name} {wf.is_system_template ? '(System)' : ''}</option>
          ))}
        </select>
        <p className="text-[11px] text-text-tertiary">Changing workflows will require mapping existing tasks to new states.</p>
      </div>

      {loading && <div className="text-sm text-text-tertiary">Generating migration preview...</div>}

      {preview && preview.totalTasks > 0 && (
        <div className="flex flex-col gap-4 p-4 border border-orange-500/30 bg-orange-500/5 rounded-xl">
          <div className="flex items-center gap-2 text-orange-400">
            <AlertTriangle className="w-4 h-4" />
            <h3 className="font-semibold text-sm">Migration Required ({preview.totalTasks} tasks)</h3>
          </div>
          
          <div className="grid gap-3">
            {Object.entries(preview.mapping).map(([oldStatus, data]) => (
              <div key={oldStatus} className="flex items-center justify-between gap-4 p-3 bg-surface-2 rounded-lg border border-border">
                <div className="flex flex-col gap-1 w-1/3">
                  <span className="text-xs font-mono uppercase text-text-secondary">{oldStatus}</span>
                  <span className="text-[10px] text-text-tertiary">{data.count} tasks</span>
                </div>
                
                <ArrowRight className="w-4 h-4 text-text-tertiary shrink-0" />
                
                <select 
                  value={manualMappings[oldStatus] || ''}
                  onChange={(e) => setManualMappings(prev => ({ ...prev, [oldStatus]: e.target.value }))}
                  className="w-1/2 p-2 bg-surface-3 border border-border rounded text-sm text-text-primary"
                >
                  <option value="">Select New State...</option>
                  {newStates.map(state => (
                    <option key={state.id} value={state.id}>{state.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedWorkflowId !== project.workflow_template_id && selectedWorkflowId !== '' && (
        <div className="flex justify-end pt-4 border-t border-border">
          <button 
            onClick={handleApply}
            disabled={applying}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {applying ? 'Applying Migration...' : 'Confirm & Apply Workflow'}
          </button>
        </div>
      )}
    </div>
  );
};
