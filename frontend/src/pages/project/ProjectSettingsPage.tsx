import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { archiveProject, restoreProject } from '../../services/projectService';
import { supabase } from '../../lib/supabase';

import { PageShell, PageHeader, Button } from '../../components/core';

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
        setSuccessMessage('Project archived successfully.');
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
        setSuccessMessage('Project restored successfully.');
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
    <PageShell maxWidth="reading">
      <PageHeader
        title="Project Settings"
        overline="Project Administration"
        description={projectName || 'Manage project configurations.'}
      />

      {successMessage && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium">
          {successMessage}
        </div>
      )}

      <div className="border border-[var(--color-border)] rounded-lg p-6 bg-[var(--color-surface-2)]">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Danger Zone</h2>
        
        {projectStatus !== 'archived' ? (
          <>
            {!showConfirm ? (
              <Button
                variant="destructive"
                onClick={() => setShowConfirm(true)}
              >
                Archive Project
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[var(--color-text-secondary)]">Are you sure you want to archive this project? This will also archive all associated tasks.</p>
                <div className="flex gap-3">
                  <Button
                    variant="destructive"
                    onClick={handleArchive}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Archiving...' : 'Confirm Archive'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <Button
            variant="secondary"
            onClick={handleRestore}
            disabled={isSubmitting}
            className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
          >
            {isSubmitting ? 'Restoring...' : 'Restore Project'}
          </Button>
        )}
      </div>
    </PageShell>
  );
}
