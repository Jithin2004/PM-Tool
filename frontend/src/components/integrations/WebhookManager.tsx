import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, ShieldAlert } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { showAlert, showConfirm, showPrompt } from '../common/Dialogs';

interface WebhookEndpoint {
  id: string;
  name: string;
  enabled: boolean;
  created_at: string;
}

export function WebhookManager() {
  const { workspace } = useWorkspace();
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEndpoints = async () => {
    if (!workspace) return;
    const { data } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false });
    
    if (data) setEndpoints(data);
    setLoading(false);
  };

  useEffect(() => {
    loadEndpoints();
  }, [workspace]);

  const handleCreate = async () => {
    if (!workspace) return;
    const name = await showPrompt('Enter a name for the new webhook endpoint:');
    if (!name) return;

    try {
      await supabase.from('webhook_endpoints').insert({
        workspace_id: workspace.id,
        name,
        enabled: true
      });
      showAlert("Endpoint created successfully.", { type: "success" });
      loadEndpoints();
    } catch (e: any) {
      showAlert(`Failed to create endpoint: ${e.message}`, { type: "error" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!await showConfirm('Are you sure you want to delete this webhook endpoint?')) return;
    try {
      await supabase.from('webhook_endpoints').delete().eq('id', id);
      showAlert("Endpoint deleted successfully.", { type: "success" });
      loadEndpoints();
    } catch (e: any) {
      showAlert(`Failed to delete endpoint: ${e.message}`, { type: "error" });
    }
  };

  if (loading) return <div>Loading webhooks...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-medium text-white">Webhook Endpoints</h2>
        <button onClick={handleCreate} className="flex items-center px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md text-sm font-medium transition-colors">
          <Plus className="w-4 h-4 mr-2" />
          Create Endpoint
        </button>
      </div>

      {endpoints.length === 0 ? (
        <div className="text-center py-10 bg-bg border border-[var(--pm-border)] rounded-lg">
          <ShieldAlert className="w-10 h-10 text-[var(--text-secondary)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)]">No webhook endpoints configured.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {endpoints.map(ep => (
            <div key={ep.id} className="bg-bg border border-[var(--pm-border)] rounded-lg p-4 flex justify-between items-center">
              <div>
                <h3 className="font-medium text-white">{ep.name}</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1 font-mono">{ep.id}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full mt-2 inline-block ${ep.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {ep.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <button onClick={() => handleDelete(ep.id)} className="p-2 text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
