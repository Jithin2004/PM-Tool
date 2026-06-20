import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { integrationEngine } from '../../core/engines/integrationEngine';
import { IntegrationCard } from '../../components/integrations/IntegrationCard';
import { WebhookManager } from '../../components/integrations/WebhookManager';
import { SyncHistory } from '../../components/integrations/SyncHistory';
import { AppWindow, Layers, History, Globe } from 'lucide-react';

type Tab = 'connected' | 'available' | 'history' | 'webhooks';

export default function IntegrationCenter() {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('connected');
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('member');

  const AVAILABLE_PROVIDERS = ['github', 'slack', 'google_calendar'];

  const loadData = async () => {
    if (!workspace || !user) return;
    
    // Check Role
    const { data: member } = await supabase.from('workspace_members').select('role').eq('workspace_id', workspace.id).eq('user_id', user.id).single();
    if (member) setUserRole(member.role);

    // Load Connections
    const { data } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('workspace_id', workspace.id);
    
    if (data) setConnections(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [workspace, user]);

  const canManage = ['owner', 'admin', 'super_admin'].includes(userRole);

  const handleConnect = async (provider: string) => {
    if (!workspace || !user || !canManage) return;
    try {
      await integrationEngine.registerIntegration(workspace.id, provider, { token: 'mock-token' }, user.id);
      loadData();
    } catch (e: any) {
      alert(`Failed to connect: ${e.message}`);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!workspace || !canManage) return;
    if (!confirm('Are you sure you want to disconnect this integration?')) return;
    try {
      await integrationEngine.disconnectIntegration(workspace.id, id);
      loadData();
    } catch (e: any) {
      alert(`Failed to disconnect: ${e.message}`);
    }
  };

  const handleReconnect = async (provider: string) => {
    if (!workspace || !user || !canManage) return;
    try {
      await integrationEngine.registerIntegration(workspace.id, provider, { token: 'mock-reconnect-token' }, user.id);
      loadData();
    } catch (e: any) {
      alert(`Failed to reconnect: ${e.message}`);
    }
  };

  if (!workspace) return null;

  return (
    <div className="flex-1 overflow-auto bg-bg-alt flex flex-col h-full">
      <div className="flex-shrink-0 bg-bg border-b border-[var(--pm-border)] p-6">
        <h1 className="text-2xl font-semibold text-white mb-2">Integration Hub</h1>
        <p className="text-[var(--text-secondary)] max-w-3xl">
          Connect Resolve PM with your external tools. Create powerful automation workflows and keep all your platforms in sync.
        </p>
      </div>

      <div className="p-6 flex-1 max-w-7xl w-full mx-auto">
        <div className="flex space-x-1 bg-[var(--pm-border)]/30 p-1 rounded-lg w-fit mb-8">
          <button onClick={() => setActiveTab('connected')} className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'connected' ? 'bg-bg text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-white'}`}>
            <AppWindow className="w-4 h-4 mr-2" /> Connected Apps
          </button>
          <button onClick={() => setActiveTab('available')} className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'available' ? 'bg-bg text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-white'}`}>
            <Layers className="w-4 h-4 mr-2" /> Available Integrations
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-bg text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-white'}`}>
            <History className="w-4 h-4 mr-2" /> Sync History
          </button>
          <button onClick={() => setActiveTab('webhooks')} className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'webhooks' ? 'bg-bg text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-white'}`}>
            <Globe className="w-4 h-4 mr-2" /> Webhooks
          </button>
        </div>

        {loading ? (
          <div className="animate-pulse flex space-x-4">
            <div className="h-32 bg-[var(--pm-border)] rounded-lg w-1/3"></div>
            <div className="h-32 bg-[var(--pm-border)] rounded-lg w-1/3"></div>
            <div className="h-32 bg-[var(--pm-border)] rounded-lg w-1/3"></div>
          </div>
        ) : (
          <div className="animate-fade-in">
            {activeTab === 'connected' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {connections.filter(c => c.status !== 'disabled').length === 0 ? (
                  <div className="col-span-full p-8 text-center border border-dashed border-[var(--pm-border)] rounded-lg text-[var(--text-secondary)]">
                    No active connections. Check the Available Integrations tab.
                  </div>
                ) : (
                  connections.filter(c => c.status !== 'disabled').map(conn => (
                    <IntegrationCard 
                      key={conn.id}
                      provider={conn.provider}
                      status={conn.status}
                      lastSyncAt={conn.last_sync_at}
                      onConnect={() => {}}
                      onDisconnect={() => handleDisconnect(conn.id)}
                      onReconnect={() => handleReconnect(conn.provider)}
                      canManage={canManage}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === 'available' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {AVAILABLE_PROVIDERS.map(provider => {
                  const existing = connections.find(c => c.provider === provider && c.status !== 'disabled');
                  if (existing) return null; // Hide if already connected
                  
                  return (
                    <IntegrationCard 
                      key={provider}
                      provider={provider}
                      status="disabled"
                      lastSyncAt={null}
                      onConnect={() => handleConnect(provider)}
                      onDisconnect={() => {}}
                      canManage={canManage}
                    />
                  );
                })}
              </div>
            )}

            {activeTab === 'history' && <SyncHistory />}

            {activeTab === 'webhooks' && <WebhookManager />}
          </div>
        )}
      </div>
    </div>
  );
}
