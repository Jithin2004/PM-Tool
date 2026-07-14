import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { updateProject } from '../../services/projectService';
import { supabase } from '../../lib/supabase';

import { PageShell, PageHeader, Input, Button } from '../../components/core';

export function ProjectEditPage() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Extract project ID from URL
  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  const projectId = pathSegments[1]; // /projects/:id/edit

  useEffect(() => {
    if (!projectId || !workspace?.id) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('name')
          .eq('id', projectId)
          .eq('workspace_id', workspace.id)
          .maybeSingle();
        if (data) {
          setName(data.name || '');
        }
      } catch (err) {
        console.error('Failed to load project:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, workspace?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace?.id || !projectId || !name.trim()) return;
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await updateProject(projectId, { name: name.trim() }, profile?.role || 'admin', workspace.id);
      setSuccessMessage('Project updated successfully.');
    } catch (err: any) {
      console.error('Failed to update project:', err);
      setErrorMessage(err?.message || 'Failed to update project.');
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
        title="Edit Project"
        overline="Project Administration"
        description="Update project identifiers and operational characteristics."
      />

      {successMessage && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="Project Name *"
          required
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Enter project name"
        />

        <Button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="w-full"
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    </PageShell>
  );
}
