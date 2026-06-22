import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ShieldAlert, Building2, FolderPlus, UserPlus, FolderKanban, Plus, X, Loader2, Users } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  status: string;
}

interface ClientUser {
  id: string;
  email: string;
  role: string;
}

interface Workspace {
  id: string;
  name: string;
  status: string;
  projects: Project[];
  users: ClientUser[];
}

type ModalType = 'WORKSPACE' | 'PROJECT' | 'CLIENT' | null;

export const SuperAdminConsole: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPassword, setNewClientPassword] = useState('');

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      // Fetch all workspaces with their associated projects and users
      const { data, error } = await supabase
        .from('workspaces')
        .select(`
          id, name, status,
          projects(id, name, status),
          users(id, email, role)
        `);

      if (error) throw error;

      // Filter to only count 'client' roles for the UI presentation
      const formattedData = (data as any[]).map(w => ({
        ...w,
        users: w.users?.filter((u: any) => u.role === 'client') || []
      }));

      setWorkspaces(formattedData);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  // ==========================================
  // LOGIC HANDLERS
  // ==========================================
  
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('workspaces').insert({
        name: newWorkspaceName,
        status: 'active'
      });
      if (error) throw error;
      
      setNewWorkspaceName('');
      setActiveModal(null);
      await fetchAdminData();
    } catch (err) {
      console.error('Failed to create workspace:', err);
      alert('Failed to create workspace. Check console.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('projects').insert({
        name: newProjectName,
        workspace_id: selectedWorkspaceId,
        status: 'planning'
      });
      if (error) throw error;
      
      setNewProjectName('');
      setSelectedWorkspaceId('');
      setActiveModal(null);
      await fetchAdminData();
    } catch (err) {
      console.error('Failed to create project:', err);
      alert('Failed to create project. Check console.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProvisionClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Securely trigger the Supabase Edge Function with the Service Role
      const { data, error } = await supabase.functions.invoke('provision-client', {
        body: { 
          email: newClientEmail, 
          password: newClientPassword, 
          workspace_id: selectedWorkspaceId 
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to invoke edge function');
      }

      if (data?.error) {
        throw new Error(data.error);
      }
      
      setNewClientEmail('');
      setNewClientPassword('');
      setSelectedWorkspaceId('');
      setActiveModal(null);
      await fetchAdminData();
      alert('Client Provisioned Successfully!');
    } catch (err: any) {
      console.error('Failed to provision client:', err);
      alert(`Provisioning Failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // RENDER HELPERS
  // ==========================================

  const renderModal = () => {
    if (!activeModal) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="flex justify-between items-center p-6 border-b border-zinc-800">
            <h3 className="text-lg font-semibold text-white">
              {activeModal === 'WORKSPACE' && 'Provision New Workspace'}
              {activeModal === 'PROJECT' && 'Create Project'}
              {activeModal === 'CLIENT' && 'Provision Client Account'}
            </h3>
            <button onClick={() => setActiveModal(null)} className="text-zinc-400 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            {activeModal === 'WORKSPACE' && (
              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Workspace Name</label>
                  <input
                    required
                    type="text"
                    value={newWorkspaceName}
                    onChange={e => setNewWorkspaceName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. Acme Corp"
                  />
                </div>
                <button disabled={isSubmitting} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors flex justify-center items-center gap-2 disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                  Create Workspace
                </button>
              </form>
            )}

            {activeModal === 'PROJECT' && (
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Assign to Workspace</label>
                  <select
                    required
                    value={selectedWorkspaceId}
                    onChange={e => setSelectedWorkspaceId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="" disabled>Select a Workspace...</option>
                    {workspaces.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Project Name</label>
                  <input
                    required
                    type="text"
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. Q4 Website Redesign"
                  />
                </div>
                <button disabled={isSubmitting} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors flex justify-center items-center gap-2 disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderKanban className="h-4 w-4" />}
                  Create Project
                </button>
              </form>
            )}

            {activeModal === 'CLIENT' && (
              <form onSubmit={handleProvisionClient} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Assign to Workspace</label>
                  <select
                    required
                    value={selectedWorkspaceId}
                    onChange={e => setSelectedWorkspaceId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="" disabled>Select a Workspace...</option>
                    {workspaces.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Client Login Email</label>
                  <input
                    required
                    type="email"
                    value={newClientEmail}
                    onChange={e => setNewClientEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="client@acme.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Temporary Password</label>
                  <input
                    required
                    type="text"
                    value={newClientPassword}
                    onChange={e => setNewClientPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="Secure temp password"
                  />
                </div>
                <button disabled={isSubmitting} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors flex justify-center items-center gap-2 disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Provision Client Credentials
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500/30">
      
      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center">
              <ShieldAlert className="h-4 w-4 text-red-500" />
            </div>
            <h1 className="font-semibold text-white tracking-tight">
              Resolve PM <span className="text-zinc-500 font-normal ml-2">Super Admin Operations</span>
            </h1>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setActiveModal('WORKSPACE')} className="px-3 py-1.5 text-sm font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md transition-colors flex items-center gap-2 text-white">
              <Building2 className="h-4 w-4" /> New Workspace
            </button>
            <button onClick={() => setActiveModal('PROJECT')} className="px-3 py-1.5 text-sm font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md transition-colors flex items-center gap-2 text-white">
              <FolderPlus className="h-4 w-4" /> New Project
            </button>
            <button onClick={() => setActiveModal('CLIENT')} className="px-3 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 border border-indigo-600 rounded-md transition-colors flex items-center gap-2 text-white shadow-lg shadow-indigo-600/20">
              <UserPlus className="h-4 w-4" /> Provision Client
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
          
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-zinc-800 bg-zinc-900/50 text-xs font-medium text-zinc-400 uppercase tracking-wider">
            <div className="col-span-4 pl-2">Workspace / Tenant</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Active Projects</div>
            <div className="col-span-3">Linked Clients</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-zinc-800/50">
            {loading ? (
              // Loading Skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-12 gap-4 p-4 items-center animate-pulse">
                  <div className="col-span-4"><div className="h-5 bg-zinc-800 rounded w-2/3 ml-2"></div></div>
                  <div className="col-span-2"><div className="h-5 bg-zinc-800 rounded w-1/2"></div></div>
                  <div className="col-span-3"><div className="h-5 bg-zinc-800 rounded w-3/4"></div></div>
                  <div className="col-span-3"><div className="h-5 bg-zinc-800 rounded w-full"></div></div>
                </div>
              ))
            ) : workspaces.length === 0 ? (
              // Empty State
              <div className="p-12 text-center">
                <Building2 className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-1">No Tenants Provisioned</h3>
                <p className="text-zinc-500 text-sm">Create your first workspace to begin provisioning the system.</p>
              </div>
            ) : (
              // Data Rows
              workspaces.map((workspace) => (
                <div key={workspace.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-zinc-800/20 transition-colors">
                  
                  {/* Workspace Name */}
                  <div className="col-span-4 flex items-center gap-3 pl-2">
                    <div className="h-8 w-8 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-zinc-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white truncate pr-4">{workspace.name}</p>
                      <p className="text-xs text-zinc-500 font-mono mt-0.5 truncate">{workspace.id.split('-')[0]}...</p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {workspace.status || 'active'}
                    </span>
                  </div>

                  {/* Projects */}
                  <div className="col-span-3">
                    <div className="flex items-center gap-2">
                      <FolderKanban className="h-4 w-4 text-zinc-500" />
                      <span className="text-sm text-zinc-300">{workspace.projects?.length || 0} Projects</span>
                    </div>
                  </div>

                  {/* Clients */}
                  <div className="col-span-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-zinc-500" />
                      <span className="text-sm text-zinc-300">
                        {workspace.users?.length || 0} Provisioned
                      </span>
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Render Active Modal */}
      {renderModal()}

    </div>
  );
};
