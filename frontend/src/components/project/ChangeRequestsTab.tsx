import React, { useState, useEffect } from 'react';
import { Plus, Check, X, Clock, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Project } from '../../types';
import { showAlert, showConfirm, showPrompt } from '../common/Dialogs';
import { hasCapability } from '../../core/auth/permissions';

export function ChangeRequestsTab({ project }: { project: Project }) {
  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const { profile } = useAuth();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [impactHours, setImpactHours] = useState('0');
  const [impactCost, setImpactCost] = useState('0');

  const fetchChangeRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('change_requests')
      .select('*, requested_by_profile:users!change_requests_requested_by_fkey(full_name, email)')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching change requests:', error);
    } else {
      setChangeRequests(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchChangeRequests();
  }, [project.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return showAlert('Title is required');

    const { error } = await supabase.from('change_requests').insert({
      workspace_id: project.workspace_id,
      project_id: project.id,
      requested_by: profile?.id,
      title,
      description,
      impact_hours: Number(impactHours) || 0,
      impact_cost: Number(impactCost) || 0,
      status: 'pending'
    });

    if (error) {
      showAlert(`Failed to create change request: ${error.message}`);
    } else {
      setIsCreating(false);
      setTitle('');
      setDescription('');
      setImpactHours('0');
      setImpactCost('0');
      fetchChangeRequests();
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    if (!await showConfirm(`Change status to ${newStatus}?`)) return;
    
    const { error } = await supabase
      .from('change_requests')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      showAlert(`Failed to update status: ${error.message}`);
    } else {
      fetchChangeRequests();
    }
  };

  const canManage = hasCapability(profile?.role as any, 'manage_projects');

  if (loading) {
    return <div className="p-8 text-center text-xs font-mono text-text-tertiary">Loading change requests...</div>;
  }

  return (
    <div className="space-y-6 mt-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" /> Client Change Requests
          </h3>
          <p className="text-[11px] text-text-tertiary mt-1">Track scope expansions and their impact on budget and timeline.</p>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 px-4 py-2 rounded-lg font-medium transition-colors text-xs"
          >
            <Plus className="w-4 h-4" />
            New CR
          </button>
        )}
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="bg-surface-2 border border-border p-5 rounded-xl space-y-4">
          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wide border-b border-border/50 pb-2 mb-4">Lodge Change Request</h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase font-mono text-text-tertiary mb-1">Title</label>
              <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-amber-500/50 outline-none" placeholder="e.g. Add payment gateway integration" />
            </div>
            
            <div>
              <label className="block text-[10px] uppercase font-mono text-text-tertiary mb-1">Description & Rationale</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-amber-500/50 outline-none min-h-[80px]" placeholder="Detailed explanation of the requested change..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-mono text-text-tertiary mb-1">Impact Hours</label>
                <input type="number" min="0" step="0.5" value={impactHours} onChange={e => setImpactHours(e.target.value)} className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-amber-500/50 outline-none" />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-mono text-text-tertiary mb-1">Impact Cost ({project.billing_currency || 'INR'})</label>
                <input type="number" min="0" step="10" value={impactCost} onChange={e => setImpactCost(e.target.value)} className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-amber-500/50 outline-none" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-xs font-medium text-text-tertiary hover:text-text-secondary">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/30">Lodge CR</button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {changeRequests.length === 0 && !isCreating ? (
          <div className="p-8 text-center text-xs font-mono text-text-tertiary bg-surface-2 rounded-xl border border-border border-dashed">
            No change requests logged for this project.
          </div>
        ) : (
          changeRequests.map(cr => (
            <div key={cr.id} className="bg-surface-2 border border-border rounded-xl p-4 transition-all hover:border-amber-500/30">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h5 className="text-sm font-semibold text-text-primary">{cr.title}</h5>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-mono tracking-wider ${
                      cr.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      cr.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      cr.status === 'implemented' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {cr.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-tertiary line-clamp-2">{cr.description || 'No description provided.'}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] font-mono text-text-tertiary mb-1">Impact Estimate</div>
                  <div className="text-xs font-semibold text-rose-400">+{cr.impact_hours} hrs</div>
                  <div className="text-xs font-semibold text-amber-400">+{project.billing_currency || 'INR'} {Number(cr.impact_cost).toLocaleString()}</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                <div className="text-[10px] text-text-tertiary">
                  Requested by: <span className="text-text-secondary">{cr.requested_by_profile?.full_name || cr.requested_by_profile?.email || 'Unknown'}</span>
                  <span className="mx-2">•</span>
                  {new Date(cr.created_at).toLocaleDateString()}
                </div>
                
                {canManage && cr.status !== 'implemented' && (
                  <div className="flex gap-2">
                    {cr.status === 'pending' && (
                      <>
                        <button onClick={() => handleUpdateStatus(cr.id, 'rejected')} className="text-[9px] px-2 py-1 bg-surface-3 hover:bg-rose-500/20 text-rose-400 rounded transition-colors flex items-center gap-1">
                          <X className="w-3 h-3" /> Reject
                        </button>
                        <button onClick={() => handleUpdateStatus(cr.id, 'approved')} className="text-[9px] px-2 py-1 bg-surface-3 hover:bg-emerald-500/20 text-emerald-400 rounded transition-colors flex items-center gap-1">
                          <Check className="w-3 h-3" /> Approve
                        </button>
                      </>
                    )}
                    {cr.status === 'approved' && (
                      <button onClick={() => handleUpdateStatus(cr.id, 'implemented')} className="text-[9px] px-2 py-1 bg-surface-3 hover:bg-blue-500/20 text-blue-400 rounded transition-colors flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Mark Implemented
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
