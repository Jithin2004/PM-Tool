import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useDashboard } from '../../context/DashboardContext';
import { Icon } from '../../components/ui/Icon';
import { activityLogService } from '../../services/activityLogService';
import { sendNotification } from '../../services/notificationService';

export function DocumentCreationModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { workspace } = useWorkspace();
  const { projects, notify } = useDashboard();
  const [requirements, setRequirements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    type: 'url',
    url: '',
    project_id: '',
    requirement_id: '',
    visibility: 'internal'
  });

  useEffect(() => {
    // Fetch requirements for the dropdown
    supabase.from('requirements').select('id, title').eq('workspace_id', workspace?.id).then(({data}) => {
      if (data) setRequirements(data);
    });
  }, [workspace?.id]);

  const validateURL = (string: string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;  
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace?.id) return;
    
    if (!validateURL(formData.url)) {
      notify("Please enter a valid URL.", "error");
      return;
    }

    setLoading(true);
    
    try {
      const { data: userResp } = await supabase.auth.getUser();

      const { data: doc, error } = await supabase.from('document_references').insert({
        workspace_id: workspace.id,
        title: formData.title,
        type: formData.type,
        url: formData.url,
        project_id: formData.project_id || null,
        requirement_id: formData.requirement_id || null,
        owner_id: userResp.user?.id,
        visibility: formData.visibility
      }).select().single();

      if (error) throw error;

      await activityLogService.appendLog({
        workspace_id: workspace.id,
        action: 'document_referenced',
        metadata: { document_id: doc.id, title: doc.title }
      });

      if (formData.project_id) {
        const project = projects.find(p => p.id === formData.project_id);
        if (project && project.team_id) {
          const { data: teamMembers } = await supabase.from('team_members').select('user_id').eq('team_id', project.team_id);
          if (teamMembers) {
            for (const member of teamMembers) {
              if (member.user_id !== userResp.user?.id) {
                await sendNotification(
                  workspace.id,
                  'system',
                  `New Document in ${project.name}`,
                  `A new ${formData.type} document "${doc.title}" was added.`,
                  member.user_id,
                  { type: 'document_added', entity_id: doc.id }
                );
              }
            }
          }
        }
      }

      onSuccess();
    } catch (err) {
      console.error("Error creating document reference", err);
      notify("Failed to add reference.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1c1d1f] p-6 rounded-xl shadow-2xl max-w-lg w-full border border-white/10 text-white max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 flex-none">
          <h2 className="text-xl font-semibold tracking-tight">Add Document Reference</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/50 hover:text-white">
            <Icon name="close" size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 pr-2 space-y-4">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-1">Name</label>
            <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-1">Type</label>
              <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                <option value="google_doc">Google Docs</option>
                <option value="figma">Figma</option>
                <option value="github">GitHub</option>
                <option value="drive">Google Drive</option>
                <option value="url">Other URL</option>
              </select>
            </div>
            <div className="flex-[2]">
              <label className="block text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-1">URL</label>
              <input required type="url" value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} placeholder="https://..." className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-1">Connect to Project</label>
              <select value={formData.project_id} onChange={e => setFormData({...formData, project_id: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                <option value="">-- None --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-1">Connect to Requirement</label>
              <select value={formData.requirement_id} onChange={e => setFormData({...formData, requirement_id: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                <option value="">-- None --</option>
                {requirements.map(r => (
                  <option key={r.id} value={r.id}>{r.title}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-1">Access & Visibility</label>
            <select value={formData.visibility} onChange={e => setFormData({...formData, visibility: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
              <option value="internal">Internal Only (Team)</option>
              <option value="client_visible">Client Visible</option>
            </select>
            <p className="text-[10px] text-gray-500 mt-1">Client visible documents can be viewed by external stakeholders via shared project links.</p>
          </div>
          
          <div className="pt-4 border-t border-white/10 flex justify-end gap-3 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white">
              {loading ? 'Adding...' : 'Add Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
