import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { capacityEngine } from '../../services/capacityEngine';
import { hasCapability } from '../../core/auth/permissions';
import { Plus, Trash2, Edit2 } from 'lucide-react';

export function AllocationPeriodManager() {
  const { profile } = useAuth();
  const { allocationPeriods, profiles, projects, notify, invalidateAll } = useDashboard();
  
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    user_id: '', project_id: '', allocation_percent: 100, start_date: '', end_date: ''
  });

  const canManage = hasCapability(profile?.role, 'manage_teams'); // Assuming PM/Admin maps to manage_teams capability

  const handleSave = async () => {
    if (!formData.user_id || !formData.project_id || !formData.start_date || !formData.end_date) {
      notify('All fields are required', 'error');
      return;
    }
    
    const valid = capacityEngine.validateAllocationChange({ ...formData, workspace_id: profile!.workspace_id } as any, [], false, allocationPeriods);
    if (!valid.allowed) {
      notify(valid.reason || 'Invalid allocation', 'error');
      return;
    }

    const success = await capacityEngine.createAllocationPeriod({
      workspace_id: profile!.workspace_id,
      user_id: formData.user_id,
      project_id: formData.project_id,
      allocation_percent: Number(formData.allocation_percent),
      start_date: formData.start_date,
      end_date: formData.end_date
    }, profile!.id);

    if (success) {
      notify('Allocation period created', 'success');
      setIsAdding(false);
      invalidateAll();
    } else {
      notify('Failed to create allocation period', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!canManage) return;
    const success = await capacityEngine.deleteAllocationPeriod(id, profile!.workspace_id, profile!.id);
    if (success) {
      notify('Allocation archived', 'success');
      invalidateAll();
    } else {
      notify('Failed to archive allocation', 'error');
    }
  };

  return (
    <div className="glass-panel rounded-xl p-6 mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold tracking-tight" style={{ color: 'var(--pm-on-surface)' }}>
          Allocation Period Management
        </h3>
        {canManage && (
          <button onClick={() => setIsAdding(!isAdding)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: 'var(--pm-primary)', color: 'white' }}>
            <Plus className="w-3 h-3" /> New Period
          </button>
        )}
      </div>

      {isAdding && (
        <div className="p-4 rounded-xl border mb-4 space-y-4" style={{ borderColor: 'var(--pm-border)', background: 'var(--pm-surface-high)' }}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <select className="input-field" value={formData.user_id} onChange={e => setFormData({ ...formData, user_id: e.target.value })}>
              <option value="">Select User</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
            </select>
            <select className="input-field" value={formData.project_id} onChange={e => setFormData({ ...formData, project_id: e.target.value })}>
              <option value="">Select Project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="number" min="0" max="100" className="input-field" placeholder="Allocation %" value={formData.allocation_percent} onChange={e => setFormData({ ...formData, allocation_percent: Number(e.target.value) })} />
            <input type="date" className="input-field" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
            <input type="date" className="input-field" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsAdding(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: 'var(--pm-surface)', color: 'var(--pm-on-surface)' }}>Cancel</button>
            <button onClick={handleSave} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: 'var(--pm-primary)', color: 'white' }}>Save</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {allocationPeriods.map(p => {
          const user = profiles.find(pr => pr.id === p.user_id);
          const project = projects.find(pr => pr.id === p.project_id);
          return (
            <div key={p.id} className="flex justify-between items-center p-3 rounded-lg border text-sm" style={{ borderColor: 'var(--pm-border)' }}>
              <div className="flex gap-6">
                <span className="font-semibold" style={{ color: 'var(--pm-on-surface)' }}>{user?.full_name || 'Unknown'}</span>
                <span style={{ color: 'var(--pm-on-surface-variant)' }}>{project?.name || 'Unknown'}</span>
                <span className="font-mono-pm uppercase text-[10px] tracking-widest">{p.allocation_percent}%</span>
                <span className="font-mono-pm text-[10px] text-gray-500">{p.start_date} to {p.end_date}</span>
              </div>
              {canManage && (
                <button onClick={() => handleDelete(p.id)} className="p-1 rounded hover:bg-red-500/10 text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
