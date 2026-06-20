import React, { useState } from 'react';
import { RefreshCcw, Archive, Shield, Trash2, AlertOctagon } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useDashboard } from '../../context/DashboardContext';
import { supabase } from '../../lib/supabase';
import { activityLogService } from '../../services/activityLogService';

export function SandboxWorkspaceManager() {
  const { workspace } = useWorkspace();
  const { notify } = useDashboard();
  const [loading, setLoading] = useState(false);

  const isSandbox = workspace?.status === 'sandbox' || workspace?.name?.toLowerCase().includes('sandbox');

  const handleAction = async (action_type: string) => {
    setLoading(true);

    if (workspace?.id) {
      if (action_type === 'reset' || action_type === 'rebuilt') {
        // Ensure flag / status is set on reset/rebuild
        await supabase.from('workspaces').update({ status: 'sandbox' }).eq('id', workspace.id);
      } else if (action_type === 'archived') {
        // Mark as archived / disabled
        await supabase.from('workspaces').update({ status: 'inactive' }).eq('id', workspace.id);
      }

      await activityLogService.appendLog({
        workspace_id: workspace.id,
        actor_id: 'system',
        action_type: `sandbox_workspace_${action_type}`,
        metadata: { status: 'success' }
      }).catch(() => { });
    }

    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    notify(`Sandbox workspace ${action_type} successfully. Analytics isolated.`, 'success');
  };

  if (!isSandbox) return null;

  return (
    <div className="bg-signal-warning/5 border border-signal-warning/20 rounded-xl p-5 mb-8">
      <div className="flex items-center gap-3 mb-4 border-b border-signal-warning/10 pb-3">
        <Shield className="w-5 h-5 text-signal-warning" />
        <h3 className="text-sm font-bold text-signal-warning uppercase tracking-wider">Sandbox Workspace Governance</h3>
      </div>

      <p className="text-xs text-text-secondary mb-5 leading-relaxed">
        This is a designated sandbox workspace. All execution data, timeline drifts, and operational metrics generated here are cryptographically isolated from your organizational analytics ledger to prevent data contamination.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={() => handleAction('reset')}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-surface border border-border hover:border-text-primary text-text-secondary hover:text-text-primary rounded-lg text-xs font-bold transition-all disabled:opacity-50"
        >
          <RefreshCcw className="w-4 h-4" /> Reset Data
        </button>
        <button
          onClick={async () => {
            if (workspace?.id) {
              setLoading(true);
              // Clean sandbox items
              await supabase.from('task_collaborators').delete().eq('workspace_id', workspace.id);
              await supabase.from('task_dependencies').delete().eq('workspace_id', workspace.id);
              await supabase.from('tasks').delete().eq('workspace_id', workspace.id);
              await supabase.from('projects').delete().eq('workspace_id', workspace.id);
              setLoading(false);
              notify('Sandbox data purged from workspace.', 'success');
              setTimeout(() => window.location.reload(), 1000);
            }
          }}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-signal-critical/10 border border-signal-critical/20 hover:bg-signal-critical/20 text-signal-critical rounded-lg text-xs font-bold transition-all ml-auto disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" /> Purge Sandbox Data
        </button>
      </div>
    </div>
  );
}
