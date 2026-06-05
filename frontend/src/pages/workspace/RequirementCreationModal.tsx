import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useDashboard } from '../../context/DashboardContext';
import { Icon } from '../../components/ui/Icon';
import { activityLogService } from '../../services/activityLogService';

export function RequirementCreationModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { workspace } = useWorkspace();
  const { projects } = useDashboard();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_name: '',
    project_id: '',
    priority: 'medium',
    acceptance_criteria: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace?.id) return;
    setLoading(true);
    
    try {
      const { data: userResp } = await supabase.auth.getUser();

      const { data: req, error } = await supabase.from('requirements').insert({
        workspace_id: workspace.id,
        title: formData.title,
        description: formData.description,
        project_id: formData.project_id || null,
        priority: formData.priority,
        acceptance_criteria: formData.acceptance_criteria,
        status: 'Draft',
        created_by: userResp.user?.id
      }).select().single();

      if (error) throw error;

      await activityLogService.appendLog({
        workspace_id: workspace.id,
        action: 'requirement_created',
        metadata: { requirement_id: req.id, title: req.title }
      });

      onSuccess();
    } catch (err) {
      console.error("Error creating requirement", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1c1d1f] p-6 rounded-xl shadow-2xl max-w-lg w-full border border-white/10 text-white max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 flex-none">
          <h2 className="text-xl font-semibold tracking-tight">New Requirement</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/50 hover:text-white">
            <Icon name="close" size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 pr-2 space-y-4">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-1">Title</label>
            <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-1">Client (Optional)</label>
            <input type="text" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} placeholder="Client name..." className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-1">Project (Optional)</label>
              <select value={formData.project_id} onChange={e => setFormData({...formData, project_id: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                <option value="">-- None --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-1">Priority</label>
              <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-1">Description</label>
            <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 min-h-[80px]" />
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-1">Acceptance Criteria</label>
            <textarea value={formData.acceptance_criteria} onChange={e => setFormData({...formData, acceptance_criteria: e.target.value})} placeholder="- System must handle 10k RPS..." className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 min-h-[80px]" />
          </div>
          
          <div className="pt-4 border-t border-white/10 flex justify-end gap-3 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white">
              {loading ? 'Creating...' : 'Create Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
