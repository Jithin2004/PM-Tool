import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { archiveProject, restoreProject } from '../../services/projectService';
import { supabase } from '../../lib/supabase';

export function ProjectSettingsPage() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const [projectStatus, setProjectStatus] = useState<string>('active');
  const [projectName, setProjectName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  // Extract project ID from URL
  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  const projectId = pathSegments[1]; // /projects/:id/settings

  useEffect(() => {
    if (!projectId || !workspace?.id) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('projects')
          .select('name, status')
          .eq('id', projectId)
          .eq('workspace_id', workspace.id)
          .maybeSingle();
        if (data) {
          setProjectName(data.name || '');
          setProjectStatus(data.status || 'active');
        }
      } catch (err) {
        console.error('Failed to load project:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, workspace?.id]);

  const handleArchive = async () => {
    if (!workspace?.id || !projectId || !profile?.id) return;
    setIsSubmitting(true);
    setSuccessMessage('');
    try {
      const ok = await archiveProject(projectId, workspace.id, profile.id);
      if (ok) {
        setProjectStatus('archived');
        setSuccessMessage('Project archived');
        setShowConfirm(false);
      }
    } catch (err) {
      console.error('Failed to archive project:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestore = async () => {
    if (!workspace?.id || !projectId || !profile?.id) return;
    setIsSubmitting(true);
    setSuccessMessage('');
    try {
      const ok = await restoreProject(projectId, workspace.id, profile.id);
      if (ok) {
        setProjectStatus('active');
        setSuccessMessage('Project restored');
      }
    } catch (err) {
      console.error('Failed to restore project:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold tracking-tight text-text-primary mb-2">Project Settings</h1>
      <p className="text-sm text-text-secondary mb-8">{projectName}</p>

      {successMessage && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm">
          {successMessage}
        </div>
      )}

      <div className="border border-border rounded-lg p-6 bg-surface-3">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Danger Zone</h2>
        
        {projectStatus !== 'archived' ? (
          <>
            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors"
              >
                Archive Project
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-text-secondary">Are you sure you want to archive this project? This will also archive all associated tasks.</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleArchive}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Archiving...' : 'Confirm Archive'}
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="px-4 py-2 border border-border text-text-secondary hover:bg-surface-3 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <button
            onClick={handleRestore}
            disabled={isSubmitting}
            className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Restoring...' : 'Restore Project'}
          </button>
        )}
      </div>
    </div>
  );
}
