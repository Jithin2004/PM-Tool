import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

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
        setSuccessMessage('Project created');
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
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold tracking-tight text-text-primary mb-6">Create Project</h1>

      {successMessage && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Project Name *</label>
          <input
            name="projectName"
            required
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-surface-3 border border-border rounded-lg px-4 py-3 text-text-primary focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Enter project name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Description (Optional)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            className="w-full bg-surface-3 border border-border rounded-lg px-4 py-3 text-text-primary focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Provide additional notes..."
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Create Project'}
        </button>
      </form>
    </div>
  );
}
