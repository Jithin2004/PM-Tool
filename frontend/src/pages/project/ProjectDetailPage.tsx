import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { updateProject } from '../../services/projectService';
import { supabase } from '../../lib/supabase';

const STATUSES = ['Planning', 'In Progress', 'On Hold', 'Completed'];

export function ProjectDetailPage() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  // Extract project ID from URL
  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  const projectId = pathSegments[1]; // /projects/:id

  useEffect(() => {
    if (!projectId || !workspace?.id) return;
    
    const fetchProject = async () => {
      try {
        const { data } = await supabase
          .from('projects')
          .select('id, name, status, description')
          .eq('id', projectId)
          .eq('workspace_id', workspace.id)
          .maybeSingle();
        if (data) setProject(data);
      } catch (err) {
        console.error('Failed to load project:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`project-${projectId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'projects',
        filter: `id=eq.${projectId}`,
      }, (payload: any) => {
        setProject((prev: any) => prev ? { ...prev, ...payload.new } : prev);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, workspace?.id]);

  const handleStatusChange = async (newStatus: string) => {
    if (!workspace?.id || !projectId) return;
    try {
      await updateProject(projectId, { status: newStatus.toLowerCase().replace(/ /g, '_') }, profile?.role || 'admin', workspace.id);
      setProject((prev: any) => prev ? { ...prev, status: newStatus.toLowerCase().replace(/ /g, '_') } : prev);
      setShowStatusMenu(false);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-text-secondary">
        Project not found
      </div>
    );
  }

  const displayStatus = (project.status || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">{project.name}</h1>
        <div className="relative">
          <button
            aria-label="Change Status"
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className="px-4 py-2 border border-border text-text-secondary hover:bg-surface-3 rounded-lg text-sm font-medium transition-colors"
          >
            {displayStatus}
          </button>
          {showStatusMenu && (
            <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-xl z-50 min-w-[160px]">
              {STATUSES.map(status => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className="block w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface-3 transition-colors first:rounded-t-lg last:rounded-b-lg"
                >
                  {status}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {project.description && (
        <p className="text-sm text-text-secondary mb-6">{project.description}</p>
      )}
    </div>
  );
}
