import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

import { PageShell, PageHeader, Input, Button } from '../../components/core';

export function ProjectCreatePage() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace?.id || !name.trim()) return;
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('projects')
        .insert({
          workspace_id: workspace.id,
          name: name.trim(),
          description: description.trim(),
          status: 'active',
          execution_mode: 'KANBAN',
          created_by_id: user.id,
          priority: 'medium',
        })
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (data?.id) {
        setSuccessMessage('Project created successfully.');
        setName('');
        setDescription('');
      } else {
        setErrorMessage('Failed to create project.');
      }
    } catch (err: any) {
      console.error('Failed to create project:', err);
      setErrorMessage(err?.message || 'Failed to create project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageShell maxWidth="reading">
      <PageHeader
        title="Create Project"
        overline="Project Administration"
        description="Initiate a new project lifecycle and map execution constraints."
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
        
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">Description (Optional)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-[var(--color-text-primary)] outline-none transition-all focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            placeholder="Provide additional details..."
          />
        </div>

        <Button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="w-full"
        >
          {isSubmitting ? 'Creating...' : 'Create Project'}
        </Button>
      </form>
    </PageShell>
  );
}
