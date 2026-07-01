import React, { useState } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { X, Users, Building, FileText, CheckCircle, Type, Layout } from 'lucide-react';
import type { Profile } from '../../types';

interface CreateTeamModalProps {
  onClose: () => void;
  onSubmit: (name: string, pmId: string, devIds: string[], extraData?: Record<string, any>) => Promise<void>;
  profiles: Profile[];
  editingTeam?: any;
}

export function CreateTeamModal({ onClose, onSubmit, profiles, editingTeam }: CreateTeamModalProps) {
  const { handleUpdateTeam } = useDashboard();
  
  const [name, setName] = useState(editingTeam?.name || '');
  const [description, setDescription] = useState(editingTeam?.data?.description || '');
  const [department, setDepartment] = useState(editingTeam?.data?.department || '');
  const [pmId, setPmId] = useState(editingTeam?.data?.pm_id || '');
  const [devIds, setDevIds] = useState<string[]>(editingTeam?.data?.developer_ids || []);
  const [color, setColor] = useState(editingTeam?.data?.color || '#6366f1'); // Default indigo
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Team name is required.');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    try {
      if (editingTeam) {
        await handleUpdateTeam(editingTeam.id, name, pmId, devIds, { description, department, color });
      } else {
        await onSubmit(name, pmId, devIds, { description, department, color });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create team');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleDev = (id: string) => {
    setDevIds(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b border-border bg-surface-2">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Layout className="w-5 h-5 text-indigo-400" />
              {editingTeam ? 'Edit Operational Team' : 'Create Operational Team'}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Organize employees into functional teams for operations and capacity planning.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-[var(--text-secondary)] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form id="create-team-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Type className="w-3.5 h-3.5" /> Team Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    placeholder="Enter team name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Building className="w-3.5 h-3.5" /> Department <span className="text-[10px] normal-case opacity-60 ml-1">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    placeholder="Select or enter department"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                    Theme Color <span className="text-[10px] normal-case opacity-60 ml-1">(Optional)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={color}
                      onChange={e => setColor(e.target.value)}
                      className="w-10 h-10 rounded border border-border cursor-pointer bg-surface-2"
                    />
                    <span className="text-sm text-[var(--text-secondary)] font-mono">{color}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" /> Description <span className="text-[10px] normal-case opacity-60 ml-1">(Optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={6}
                  className="w-full bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                  placeholder="Provide additional details..."
                />
              </div>
            </div>

            <div className="pt-4 border-t border-border space-y-6">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Team Lead <span className="text-[10px] normal-case opacity-60 ml-1">(Optional)</span>
                </label>
                <select
                  value={pmId}
                  onChange={e => setPmId(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
                >
                  <option value="" disabled>Select Team Lead</option>
                  <option value="none">No Lead Assigned</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-blue-400" /> Team Members
                </label>
                <div className="bg-surface-2 border border-border rounded-lg max-h-48 overflow-y-auto divide-y divide-border">
                  {profiles.map(p => (
                    <label key={p.id} className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={devIds.includes(p.id)}
                        onChange={() => toggleDev(p.id)}
                        className="rounded border-border text-indigo-500 focus:ring-indigo-500 bg-surface"
                      />
                      <span className="text-sm text-white">{p.full_name || p.email}</span>
                      {pmId === p.id && (
                        <span className="ml-auto text-[10px] uppercase font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">Lead</span>
                      )}
                    </label>
                  ))}
                  {profiles.length === 0 && (
                    <div className="p-4 text-center text-sm text-[var(--text-secondary)] italic">
                      No profiles available.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="p-5 border-t border-border bg-surface-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-surface-3 hover:bg-surface-4 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-team-form"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
          >
            {isSubmitting ? (editingTeam ? 'Saving...' : 'Creating Team...') : (editingTeam ? 'Save Changes' : 'Create Team')}
          </button>
        </div>
      </div>
    </div>
  );
}
