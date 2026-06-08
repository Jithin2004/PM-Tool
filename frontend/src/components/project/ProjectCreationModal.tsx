import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X, Plus, Trash2, ShieldAlert, DollarSign, Users, Target, FileText, Settings, Briefcase, Calendar } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { hasCapability } from '../../core/auth/permissions';
import { createProject } from '../../services/projectService';
import type { CreateProjectInput } from '../../services/projectService';

interface ProjectCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type TabKey = 'identity' | 'planning' | 'requirements' | 'milestones' | 'team' | 'execution' | 'finance';

export function ProjectCreationModal({ isOpen, onClose, onSuccess }: ProjectCreationModalProps) {
  const { workspace, activeTeams, profiles } = useWorkspace() as any;
  const { profile } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('identity');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<CreateProjectInput>({
    workspace_id: workspace?.id || '',
    name: '',
    description: '',
    status: 'planning',
    priority: 'medium',
    execution_mode: 'KANBAN',
    proposed_start_date: new Date().toISOString().split('T')[0],
    client_deadline: '',
    client_id: '',
    department_id: '',
    owner_id: profile?.id || '',
    billing_model: 'Fixed Price',
    budget: 0,
    billing_currency: 'USD',
    approval_workflow: 'standard',
    pert_enabled: true,
    allocations: [],
    initialRequirements: [],
    initialMilestones: [],
  });

  const [reqTitle, setReqTitle] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [reqAc, setReqAc] = useState('');
  const [reqClientVis, setReqClientVis] = useState(false);

  const [msName, setMsName] = useState('');
  const [msDate, setMsDate] = useState('');

  const [allocUser, setAllocUser] = useState('');
  const [allocPercent, setAllocPercent] = useState(100);

  // Derived available users (non-archived)
  const availableUsers = useMemo(() => {
    return (profiles || []).filter((p: any) => p.status !== 'archived');
  }, [profiles]);

  if (!isOpen) return null;

  const handleUpdate = (field: keyof CreateProjectInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addRequirement = () => {
    if (!reqTitle) return;
    setFormData(prev => ({
      ...prev,
      initialRequirements: [...(prev.initialRequirements || []), { title: reqTitle, description: reqDesc, acceptance_criteria: reqAc, client_visible: reqClientVis }]
    }));
    setReqTitle(''); setReqDesc(''); setReqAc(''); setReqClientVis(false);
  };

  const addMilestone = () => {
    if (!msName || !msDate) return;
    setFormData(prev => ({
      ...prev,
      initialMilestones: [...(prev.initialMilestones || []), { name: msName, target_date: msDate }]
    }));
    setMsName(''); setMsDate('');
  };

  const addAllocation = () => {
    if (!allocUser) return;
    setFormData(prev => ({
      ...prev,
      allocations: [...(prev.allocations || []), { user_id: allocUser, allocation_percent: allocPercent }]
    }));
    setAllocUser(''); setAllocPercent(100);
  };

  const removeArrayItem = (field: 'initialRequirements' | 'initialMilestones' | 'allocations', index: number) => {
    setFormData(prev => {
      const arr = [...(prev[field] as any[])];
      arr.splice(index, 1);
      return { ...prev, [field]: arr };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return alert('Project Designation is required');
    setIsSubmitting(true);
    try {
      const res = await createProject({ ...formData, workspace_id: workspace.id });
      if (res) {
        onSuccess?.();
        onClose();
      } else {
        alert('Failed to create project.');
      }
    } catch (err) {
      console.error(err);
      alert('Error creating project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs: { id: TabKey; label: string; icon: any }[] = [
    { id: 'identity', label: 'Identity', icon: Briefcase },
    { id: 'planning', label: 'Planning', icon: Calendar },
    { id: 'requirements', label: 'Requirements', icon: FileText },
    { id: 'milestones', label: 'Milestones', icon: Target },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'execution', label: 'Execution', icon: Settings },
  ];

  if (hasCapability(profile?.role, 'manage_finance')) {
    tabs.push({ id: 'finance', label: 'Finance', icon: DollarSign });
  }



  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/90 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative bg-surface border border-border/50 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden font-geist text-[var(--pm-on-surface)]"
      >
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-teal-500 to-emerald-500" />
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-teal-500/10 border border-teal-500/20 rounded-xl flex items-center justify-center shadow-inner">
              <Zap className="w-6 h-6 text-teal-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold tracking-tight text-text-primary">Enterprise Create Project</h3>
              <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest mt-1">Configure parameters & constraints</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-3 transition-colors text-text-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-48 border-r border-border/50 bg-surface-lowest p-4 flex flex-col gap-1 overflow-y-auto shrink-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.id 
                    ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' 
                    : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary border border-transparent'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Form Content Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-surface">
            <form id="project-form" onSubmit={handleSubmit} className="space-y-6">
              
              {/* Identity Tab */}
              {activeTab === 'identity' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div>
                    <label className="block text-[11px] uppercase font-bold tracking-widest text-text-secondary mb-2">Project Designation *</label>
                    <input autoFocus required type="text" value={formData.name} onChange={e => handleUpdate('name', e.target.value)} className="w-full bg-surface-3/50 border border-border/50 h-12 px-4 rounded-xl text-sm focus:border-teal-500/50 outline-none" placeholder="E.g. QUANTUM CORE UPGRADE" />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase font-bold tracking-widest text-text-secondary mb-2">Description</label>
                    <textarea value={formData.description} onChange={e => handleUpdate('description', e.target.value)} className="w-full bg-surface-3/50 border border-border/50 p-4 rounded-xl text-sm focus:border-teal-500/50 outline-none min-h-[100px]" placeholder="Detailed mandate..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] uppercase font-bold tracking-widest text-text-secondary mb-2">Project Owner</label>
                      <select value={formData.owner_id} onChange={e => handleUpdate('owner_id', e.target.value)} className="w-full bg-surface-3/50 border border-border/50 h-12 px-4 rounded-xl text-sm outline-none">
                        <option value="">Select Owner</option>
                        {availableUsers.map((u: any) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Planning Tab */}
              {activeTab === 'planning' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] uppercase font-bold tracking-widest text-text-secondary mb-2">Start Date</label>
                      <input type="date" value={formData.proposed_start_date} onChange={e => handleUpdate('proposed_start_date', e.target.value)} className="w-full bg-surface-3/50 border border-border/50 h-12 px-4 rounded-xl text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase font-bold tracking-widest text-text-secondary mb-2">Target Delivery Date</label>
                      <input type="date" value={formData.client_deadline} onChange={e => handleUpdate('client_deadline', e.target.value)} className="w-full bg-surface-3/50 border border-border/50 h-12 px-4 rounded-xl text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase font-bold tracking-widest text-text-secondary mb-2">Priority</label>
                      <select value={formData.priority} onChange={e => handleUpdate('priority', e.target.value)} className="w-full bg-surface-3/50 border border-border/50 h-12 px-4 rounded-xl text-sm outline-none">
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase font-bold tracking-widest text-text-secondary mb-2">Status</label>
                      <select value={formData.status} onChange={e => handleUpdate('status', e.target.value)} className="w-full bg-surface-3/50 border border-border/50 h-12 px-4 rounded-xl text-sm outline-none">
                        <option value="planning">Planning</option>
                        <option value="active">Active</option>
                        <option value="in-progress">In Progress</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Requirements Tab */}
              {activeTab === 'requirements' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-surface-3/30 border border-border/50 p-4 rounded-xl space-y-3">
                    <h4 className="text-sm font-semibold">Add Initial Requirement</h4>
                    <input type="text" value={reqTitle} onChange={e => setReqTitle(e.target.value)} placeholder="Requirement Title" className="w-full bg-surface border border-border h-10 px-3 rounded-lg text-sm outline-none" />
                    <textarea value={reqDesc} onChange={e => setReqDesc(e.target.value)} placeholder="Description" className="w-full bg-surface border border-border p-3 rounded-lg text-sm outline-none" />
                    <textarea value={reqAc} onChange={e => setReqAc(e.target.value)} placeholder="Acceptance Criteria" className="w-full bg-surface border border-border p-3 rounded-lg text-sm outline-none" />
                    <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                      <input type="checkbox" checked={reqClientVis} onChange={e => setReqClientVis(e.target.checked)} className="rounded border-border bg-surface" />
                      Client Visible
                    </label>
                    <button type="button" onClick={addRequirement} className="bg-surface-high hover:bg-surface-highest text-sm font-medium px-4 py-2 rounded-lg transition-colors border border-border">
                      Add Requirement
                    </button>
                  </div>
                  
                  {formData.initialRequirements?.length > 0 && (
                    <div className="space-y-2 mt-4">
                      {formData.initialRequirements.map((r, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-surface-lowest border border-border rounded-lg text-sm">
                          <div>
                            <span className="font-semibold">{r.title}</span>
                            {r.client_visible && <span className="ml-2 text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">Visible</span>}
                          </div>
                          <button type="button" onClick={() => removeArrayItem('initialRequirements', i)} className="text-red-400 hover:text-red-300 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Milestones Tab */}
              {activeTab === 'milestones' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-surface-3/30 border border-border/50 p-4 rounded-xl space-y-3">
                    <h4 className="text-sm font-semibold">Add Milestone</h4>
                    <div className="flex gap-2">
                      <input type="text" value={msName} onChange={e => setMsName(e.target.value)} placeholder="Milestone Name" className="flex-1 bg-surface border border-border h-10 px-3 rounded-lg text-sm outline-none" />
                      <input type="date" value={msDate} onChange={e => setMsDate(e.target.value)} className="w-40 bg-surface border border-border h-10 px-3 rounded-lg text-sm outline-none" />
                    </div>
                    <button type="button" onClick={addMilestone} className="bg-surface-high hover:bg-surface-highest text-sm font-medium px-4 py-2 rounded-lg transition-colors border border-border">
                      Add Milestone
                    </button>
                  </div>
                  
                  {formData.initialMilestones?.length > 0 && (
                    <div className="space-y-2 mt-4">
                      {formData.initialMilestones.map((m, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-surface-lowest border border-border rounded-lg text-sm">
                          <div>
                            <span className="font-semibold">{m.name}</span>
                            <span className="ml-3 text-text-tertiary">{m.target_date}</span>
                          </div>
                          <button type="button" onClick={() => removeArrayItem('initialMilestones', i)} className="text-red-400 hover:text-red-300 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Team Tab */}
              {activeTab === 'team' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl flex gap-3 text-sm text-blue-400 items-start">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <p>Archived employees are hidden. Check capacity before assigning 100% allocation.</p>
                  </div>
                  <div className="bg-surface-3/30 border border-border/50 p-4 rounded-xl space-y-3">
                    <h4 className="text-sm font-semibold">Assign Member</h4>
                    <div className="flex gap-2">
                      <select value={allocUser} onChange={e => setAllocUser(e.target.value)} className="flex-1 bg-surface border border-border h-10 px-3 rounded-lg text-sm outline-none">
                        <option value="">Select User...</option>
                        {availableUsers.map((u: any) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                      </select>
                      <input type="number" min="0" max="100" value={allocPercent} onChange={e => setAllocPercent(Number(e.target.value))} placeholder="%" className="w-20 bg-surface border border-border h-10 px-3 rounded-lg text-sm outline-none" title="Allocation %" />
                    </div>
                    <button type="button" onClick={addAllocation} className="bg-surface-high hover:bg-surface-highest text-sm font-medium px-4 py-2 rounded-lg transition-colors border border-border">
                      Assign
                    </button>
                  </div>
                  
                  {formData.allocations?.length > 0 && (
                    <div className="space-y-2 mt-4">
                      {formData.allocations.map((a, i) => {
                        const user = availableUsers.find((u: any) => u.id === a.user_id);
                        return (
                          <div key={i} className="flex items-center justify-between p-3 bg-surface-lowest border border-border rounded-lg text-sm">
                            <div>
                              <span className="font-semibold">{user?.full_name || user?.email || 'Unknown User'}</span>
                              <span className={`ml-3 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${a.allocation_percent! > 80 ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                {a.allocation_percent}% ALLOCATED
                              </span>
                            </div>
                            <button type="button" onClick={() => removeArrayItem('allocations', i)} className="text-red-400 hover:text-red-300 p-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Execution Tab */}
              {activeTab === 'execution' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] uppercase font-bold tracking-widest text-text-secondary mb-2">Methodology</label>
                      <select value={formData.execution_mode} onChange={e => handleUpdate('execution_mode', e.target.value)} className="w-full bg-surface-3/50 border border-border/50 h-12 px-4 rounded-xl text-sm outline-none">
                        <option value="KANBAN">Kanban</option>
                        <option value="SCRUM">Scrum</option>
                        <option value="HYBRID">Hybrid</option>
                        <option value="SDLC">SDLC</option>
                        <option value="CUSTOM">Custom</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase font-bold tracking-widest text-text-secondary mb-2">Approval Workflow</label>
                      <select value={formData.approval_workflow} onChange={e => handleUpdate('approval_workflow', e.target.value)} className="w-full bg-surface-3/50 border border-border/50 h-12 px-4 rounded-xl text-sm outline-none">
                        <option value="standard">Standard (PM Review)</option>
                        <option value="strict">Strict (Multi-level Signoff)</option>
                        <option value="none">None (Auto-approve)</option>
                      </select>
                    </div>
                  </div>
                  <div className="p-4 bg-surface-3/30 border border-border/50 rounded-xl">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={formData.pert_enabled} onChange={e => handleUpdate('pert_enabled', e.target.value)} className="w-5 h-5 rounded border-border bg-surface accent-teal-500" />
                      <div>
                        <div className="font-semibold text-sm">Enable PERT Estimation</div>
                        <div className="text-xs text-text-tertiary">Allow tasks to have Optimistic, Likely, and Pessimistic time estimations.</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Finance Tab */}
              {activeTab === 'finance' && hasCapability(profile?.role, 'manage_finance') && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] uppercase font-bold tracking-widest text-text-secondary mb-2">Billing Model</label>
                      <select value={formData.billing_model} onChange={e => handleUpdate('billing_model', e.target.value)} className="w-full bg-surface-3/50 border border-border/50 h-12 px-4 rounded-xl text-sm outline-none">
                        <option value="Fixed Price">Fixed Price</option>
                        <option value="Hourly">Hourly</option>
                        <option value="Milestone Based">Milestone Based</option>
                        <option value="Retainer">Retainer</option>
                        <option value="Internal Project">Internal Project (Non-billable)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase font-bold tracking-widest text-text-secondary mb-2">Currency</label>
                      <select value={formData.billing_currency} onChange={e => handleUpdate('billing_currency', e.target.value)} className="w-full bg-surface-3/50 border border-border/50 h-12 px-4 rounded-xl text-sm outline-none">
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] uppercase font-bold tracking-widest text-text-secondary mb-2">Total Budget / Contract Value</label>
                      <div className="relative">
                        <span className="absolute left-4 top-3.5 text-text-tertiary">$</span>
                        <input type="number" min="0" step="0.01" value={formData.budget} onChange={e => handleUpdate('budget', Number(e.target.value))} className="w-full bg-surface-3/50 border border-border/50 h-12 pl-8 pr-4 rounded-xl text-sm outline-none" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </form>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-border/50 flex justify-end gap-3 shrink-0 bg-surface">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-text-secondary hover:bg-surface-3 rounded-lg transition-colors">
            Cancel
          </button>
          <button form="project-form" type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-[var(--pm-text)] text-[var(--text-primary)] rounded-lg text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_0_15px_rgba(20,184,166,0.3)]">
            {isSubmitting ? <span className="animate-pulse">Committing...</span> : 'Create Project'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
