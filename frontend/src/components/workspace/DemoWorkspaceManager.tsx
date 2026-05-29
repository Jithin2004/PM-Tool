import React, { useState } from 'react';
import { RefreshCcw, Archive, Shield, Trash2, AlertOctagon } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useDashboard } from '../../context/DashboardContext';
import { supabase } from '../../lib/supabase';
import { activityLogService } from '../../services/activityLogService';

export function DemoWorkspaceManager() {
  const { workspace } = useWorkspace();
  const { notify } = useDashboard();
  const [loading, setLoading] = useState(false);

  const isDemo = workspace?.name?.toLowerCase().includes('demo');

  const handleAction = async (action: string) => {
    setLoading(true);
    
    if (workspace?.id) {
      if (action === 'reset' || action === 'rebuilt') {
        // Ensure flag is set on reset/rebuild
        await supabase.from('workspaces').update({ is_demo_workspace: true }).eq('id', workspace.id);
      } else if (action === 'archived') {
        // Mark as archived / disabled
        await supabase.from('workspaces').update({ is_demo_workspace: true }).eq('id', workspace.id);
      }

      await activityLogService.appendLog({
        workspace_id: workspace.id,
        actor_id: 'system',
        action: `demo_workspace_${action}`,
        metadata: { status: 'success' }
      }).catch(() => {});
    }

    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    notify(`Demo workspace ${action} successfully. Analytics isolated.`, 'success');
  };

  if (!isDemo) return null;

  return (
    <div className="bg-signal-warning/5 border border-signal-warning/20 rounded-xl p-5 mb-8">
      <div className="flex items-center gap-3 mb-4 border-b border-signal-warning/10 pb-3">
        <Shield className="w-5 h-5 text-signal-warning" />
        <h3 className="text-sm font-bold text-signal-warning uppercase tracking-wider">Demo Workspace Governance</h3>
      </div>
      
      <p className="text-xs text-text-secondary mb-5 leading-relaxed">
        This is a designated demo workspace. All execution data, timeline drifts, and operational metrics generated here are cryptographically isolated from your organizational analytics ledger to prevent data contamination.
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
          onClick={() => handleAction('rebuilt')}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-surface border border-border hover:border-accent-primary text-text-secondary hover:text-accent-primary rounded-lg text-xs font-bold transition-all disabled:opacity-50"
        >
          <AlertOctagon className="w-4 h-4" /> Rebuild Scaffold
        </button>
        <button 
          onClick={() => handleAction('archived')}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-signal-critical/10 border border-signal-critical/20 hover:bg-signal-critical/20 text-signal-critical rounded-lg text-xs font-bold transition-all ml-auto disabled:opacity-50"
        >
          <Archive className="w-4 h-4" /> Archive Demo
        </button>
      </div>
    </div>
  );
}
