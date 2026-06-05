import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { ResolveLayout } from '../../app/layouts/ResolveLayout';
import { Check, Layers, Users, Zap, Briefcase, Plus, X, ArrowLeft } from 'lucide-react';
import { EmailChipsInput, EmailChip } from '../../components/ui/EmailChipsInput';
import { ProjectChipsInput } from '../../components/ui/ProjectChipsInput';
import { demoWorkspacesService } from '../../services/demoWorkspacesService';
import { clearLicense } from '../../lib/productKey';
import { supabase } from '../../lib/supabase';

const TEMPLATE_SUMMARIES: Record<string, { projects: number, milestones: number, tasks: number, members: number, recommendedFor: string }> = {
  'ERP Implementation': { projects: 3, milestones: 12, tasks: 45, members: 8, recommendedFor: 'Enterprise Transformation' },
  'Software Product Launch': { projects: 2, milestones: 8, tasks: 34, members: 5, recommendedFor: 'Product Teams' },
  'Government Digital Transformation': { projects: 4, milestones: 15, tasks: 62, members: 12, recommendedFor: 'Public Sector' },
  'Internal Operations Program': { projects: 2, milestones: 6, tasks: 28, members: 4, recommendedFor: 'Ops Teams' },
  'Client Delivery Agency': { projects: 5, milestones: 20, tasks: 85, members: 10, recommendedFor: 'Agencies & Consultancies' }
};

export function WorkspaceSetupWizard() {
  const { createWorkspace, error } = useWorkspace();
  const { refreshProfile, profile, user } = useAuth();
  
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [workingTimeFrom, setWorkingTimeFrom] = useState('09:00');
  const [workingTimeTo, setWorkingTimeTo] = useState('17:00');
  const [members, setMembers] = useState<EmailChip[]>([]);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleFinish = async () => {
    setLoading(true);
    try {
      const created = await createWorkspace({
        name: name || 'My Workspace',
        settings: { 
          companyName: name || 'My Workspace',
          departments: departments,
          workingTimeFrom: workingTimeFrom,
          workingTimeTo: workingTimeTo
        } as any
      });
      if (created) {
        if (members.length > 0) {
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          const inserts = members.map(m => ({
            email: m.email,
            workspace_id: created.id,
            role: m.role.toLowerCase(),
            status: 'pending',
            invited_by: user?.id,
            expires_at: expiresAt
          }));
          await supabase.from('invitations').insert(inserts);
        }
        clearLicense();
        await refreshProfile();
        window.location.href = '/overview';
      }
    } catch (err: any) {
      console.error(err);
      if (err?.code === '42P01' || err?.message?.includes('relation "workspaces" does not exist')) {
        setDbError('Database not initialized. You must execute RESOLVE_PM_PRODUCTION_MASTER_SCHEMA.sql in your Supabase SQL Editor.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    if (!selectedTemplate) return;
    setDemoLoading(true);
    try {
      const ws = await createWorkspace({
        name: selectedTemplate,
        settings: { companyName: selectedTemplate } as any
      });
      if (ws) {
        await demoWorkspacesService.injectDemoData(ws.id, profile!.id, selectedTemplate);
        clearLicense();
        await refreshProfile();
        window.location.href = '/overview';
      }
    } catch (err: any) {
      console.error(err);
      if (err?.code === '42P01' || err?.message?.includes('relation "workspaces" does not exist')) {
        setDbError('Database not initialized. You must execute RESOLVE_PM_PRODUCTION_MASTER_SCHEMA.sql in your Supabase SQL Editor.');
      }
    } finally {
      setDemoLoading(false);
    }
  };

  const toggleTemplate = (type: string) => {
    if (selectedTemplate === type) {
      setSelectedTemplate(null);
      setName('');
    } else {
      setSelectedTemplate(type);
      setName(type);
    }
  };

  const getRoleCounts = () => {
    return members.reduce((acc, m) => {
      acc[m.role] = (acc[m.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  };

  return (
    <ResolveLayout eyebrow="Onboarding">
      <div className="grid gap-8 lg:grid-cols-2 max-w-5xl mx-auto items-start">
        <section className="bg-surface-3 border border-border/50 rounded-2xl p-8 shadow-sm font-geist">
          
          <div className="flex justify-between text-[10px] sm:text-xs font-mono uppercase tracking-widest text-[var(--pm-on-surface-variant)] mb-8 border-b border-border/50 pb-4">
            <div className="flex gap-2 sm:gap-4 flex-wrap">
              <span className={step >= 1 ? "text-[var(--pm-primary)] font-bold" : ""}>Details {step > 1 ? '✓' : '○'}</span>
              <span className={step >= 2 ? "text-[var(--pm-primary)] font-bold" : ""}>Departments {step > 2 ? '✓' : '○'}</span>
              <span className={step >= 3 ? "text-[var(--pm-primary)] font-bold" : ""}>Hours {step > 3 ? '✓' : '○'}</span>
              <span className={step >= 4 ? "text-[var(--pm-primary)] font-bold" : ""}>Team Import {step > 4 ? '✓' : '○'}</span>
              <span className={step >= 5 ? "text-[var(--pm-primary)] font-bold" : ""}>Roles {step > 5 ? '✓' : '○'}</span>
              <span className={step >= 6 ? "text-[var(--pm-primary)] font-bold" : ""}>Launch {step > 6 ? '✓' : '○'}</span>
            </div>
            <div className="text-right hidden sm:block shrink-0 pl-4">
              <span className="block opacity-50">Estimated setup time:</span>
              <span className="font-bold text-[var(--pm-on-surface)]">
                {'< 2 minutes'}
              </span>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-6 text-[var(--pm-on-surface)]">Guided Setup</h2>
          
          {dbError && (
            <div className="mb-6 p-4 border border-red-500/50 bg-red-500/10 rounded-lg animate-in fade-in">
              <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">!</span>
                Database Missing
              </h3>
              <p className="text-sm text-red-200 leading-relaxed">
                {dbError}
              </p>
              <p className="text-xs text-red-300 mt-2 font-mono">
                Please copy the contents of <strong>RESOLVE_PM_PRODUCTION_MASTER_SCHEMA.sql</strong> and run it in your Supabase project's SQL Editor to create the necessary tables.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <label className="block text-sm font-semibold">Step 1: Workspace Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full p-3 rounded bg-surface-4 border border-border/50 focus:border-[var(--pm-primary)] focus:outline-none transition-colors" placeholder="e.g. Acme Corp" />
            </div>
          )}
          
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <label className="block text-sm font-semibold">Step 2: Departments</label>
              <ProjectChipsInput
                value={departments}
                onChange={setDepartments}
                placeholder="E.g. Engineering, Sales (press Enter)"
              />
              <p className="text-[11px] text-[var(--pm-on-surface-variant)] italic mt-2">Departments help organize teams and reports.</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <label className="block text-sm font-semibold">Step 3: Company Working Hours</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-text-tertiary mb-1">Start Time</label>
                  <input type="time" value={workingTimeFrom} onChange={e => setWorkingTimeFrom(e.target.value)} className="w-full p-3 rounded bg-surface-4 border border-border/50 focus:border-[var(--pm-primary)] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-text-tertiary mb-1">End Time</label>
                  <input type="time" value={workingTimeTo} onChange={e => setWorkingTimeTo(e.target.value)} className="w-full p-3 rounded bg-surface-4 border border-border/50 focus:border-[var(--pm-primary)] focus:outline-none" />
                </div>
              </div>
              <p className="text-[11px] text-[var(--pm-on-surface-variant)] italic mt-2">Used for capacity planning and availability tracking.</p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <label className="block text-sm font-semibold">Step 4: Import Employees</label>
              <EmailChipsInput 
                value={members} 
                onChange={setMembers} 
                placeholder="Emails, press Enter to add" 
              />
              <div className="p-4 mt-2 bg-surface-4 border border-border/50 rounded-lg text-sm text-[var(--pm-on-surface-variant)]">
                <p><strong>Note:</strong> Bulk CSV import is also available later from the HR dashboard.</p>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <label className="block text-sm font-semibold">Step 5: Assign Roles</label>
              {members.length === 0 ? (
                <p className="text-sm text-[var(--pm-on-surface-variant)] italic">No team members added. You can skip this step.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 border border-border/50 rounded-lg p-2 bg-surface-4">
                  {members.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-surface-3 rounded border border-border/50">
                      <span className="text-sm font-medium">{m.email}</span>
                      <select 
                        value={m.role}
                        onChange={(e) => {
                          const newMembers = [...members];
                          newMembers[idx].role = e.target.value as any;
                          setMembers(newMembers);
                        }}
                        className="bg-surface-4 border border-border/50 text-xs rounded px-2 py-1 outline-none"
                      >
                        <option value="Employee">Employee (Internal)</option>
                        <option value="PM">Project Manager</option>
                        <option value="HR">HR/Admin</option>
                        <option value="External Access">External Access</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {step === 6 && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-[var(--pm-on-surface)]">Ready for Launch</h3>
                <p className="text-sm text-[var(--pm-on-surface-variant)] mt-1">Please review your workspace configuration.</p>
              </div>
              
              <div className="bg-surface-4 rounded-xl p-5 border border-border/50 space-y-4">
                <div className="flex justify-between items-center border-b border-border/50 pb-3">
                  <span className="text-xs font-mono uppercase text-[var(--pm-on-surface-variant)]">Workspace</span>
                  <span className="font-semibold text-[var(--pm-on-surface)] truncate max-w-[150px] md:max-w-[200px]">{name || 'My Workspace'}</span>
                </div>
                
                {departments.length > 0 && (
                  <div className="border-b border-border/50 pb-3">
                    <span className="text-xs font-mono uppercase text-[var(--pm-on-surface-variant)] block mb-2">Departments</span>
                    <ul className="text-sm text-[var(--pm-on-surface)] space-y-1 list-inside list-disc pl-1">
                      {departments.map((dep, idx) => (
                        <li key={idx} className="truncate">{dep}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="flex justify-between items-center border-b border-border/50 pb-3">
                  <span className="text-xs font-mono uppercase text-[var(--pm-on-surface-variant)]">Invitations</span>
                  <span className="font-semibold text-[var(--pm-on-surface)]">{members.length}</span>
                </div>
                
                {members.length > 0 && (
                  <div className="border-b border-border/50 pb-3">
                    <span className="text-xs font-mono uppercase text-[var(--pm-on-surface-variant)] block mb-2">Roles</span>
                    <ul className="text-sm text-[var(--pm-on-surface)] space-y-1 pl-1">
                      {Object.entries(getRoleCounts()).map(([role, count]) => (
                        <li key={role} className="flex justify-between">
                          <span>{count} {role}{count > 1 && role !== 'PM' ? 's' : count > 1 && role === 'PM' ? 's' : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="flex justify-between items-center pb-1">
                  <span className="text-xs font-mono uppercase text-[var(--pm-on-surface-variant)]">Template</span>
                  <span className="font-semibold text-[var(--pm-on-surface)]">Manual Configuration</span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <button disabled={step === 1 || selectedTemplate !== null} onClick={() => setStep(s => s - 1)} className="px-4 py-2 rounded border border-border/50 disabled:opacity-50 transition-colors">Back</button>
            {step < 6 ? (
              <button disabled={selectedTemplate !== null || (step === 1 && !name.trim())} onClick={() => setStep(s => s + 1)} className="px-4 py-2 rounded bg-[var(--pm-primary)] text-[var(--pm-text)] dark:text-white disabled:opacity-50 disabled:bg-surface-4 transition-colors">Next</button>
            ) : (
              <button onClick={handleFinish} disabled={loading || selectedTemplate !== null} className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-[var(--pm-text)] dark:text-white flex items-center gap-2 disabled:opacity-50 disabled:bg-surface-4 transition-colors font-medium">
                {loading ? 'Building...' : 'Complete Setup'} <Zap className="w-4 h-4 fill-white text-[var(--pm-text)] dark:text-white" />
              </button>
            )}
          </div>
        </section>

        <aside className="bg-surface-3 border border-border/50 rounded-2xl p-8 shadow-sm font-geist h-fit space-y-6 lg:sticky top-8">
          <h3 className="font-semibold text-[var(--pm-on-surface)] flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400"/> Instant Demo Workspaces</h3>
          <p className="text-xs text-[var(--pm-on-surface-variant)]">Bypass manual configuration and instantiate a fully-loaded enterprise simulator.</p>
          
          <div className="space-y-3">
            {Object.keys(TEMPLATE_SUMMARIES).map(type => {
              const isSelected = selectedTemplate === type;
              const summary = TEMPLATE_SUMMARIES[type];
              
              return (
                <button 
                  key={type} 
                  onClick={() => toggleTemplate(type)} 
                  disabled={demoLoading} 
                  className={`w-full p-4 border rounded-xl text-left flex flex-col group transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--pm-primary)] focus:ring-offset-2 focus:ring-offset-surface-3 ${
                    isSelected 
                      ? 'border-[var(--pm-primary)] bg-[var(--pm-primary)]/10 shadow-sm ring-1 ring-[var(--pm-primary)]/50' 
                      : 'border-border/50 hover:border-[var(--pm-primary)]/70 bg-surface-2 hover:bg-surface-3'
                  }`}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <Briefcase className={`w-5 h-5 transition-colors ${isSelected ? 'text-[var(--pm-primary)]' : 'text-[var(--pm-on-surface-variant)] group-hover:text-[var(--pm-primary)]'}`} />
                      <span className={`text-sm font-medium transition-colors ${isSelected ? 'text-[var(--pm-on-surface)]' : 'text-[var(--pm-on-surface-variant)] group-hover:text-[var(--pm-on-surface)]'}`}>{type}</span>
                    </div>
                    {isSelected ? (
                      <X className="w-4 h-4 text-[var(--pm-primary)]" />
                    ) : (
                      <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 text-[var(--pm-on-surface-variant)] transition-all" />
                    )}
                  </div>
                  
                  {isSelected && (
                    <div className="mt-4 pt-4 border-t border-[var(--pm-primary)]/20 animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center gap-1.5 mb-4 text-[11px] font-medium text-[var(--pm-primary)] bg-[var(--pm-primary)]/10 inline-flex px-2 py-1 rounded-md">
                        <span>Recommended For:</span>
                        <span className="text-[var(--pm-on-surface)]">{summary.recommendedFor}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                        <div className="text-xs">
                           <div className="text-[var(--pm-on-surface-variant)] uppercase tracking-wider text-[10px]">Projects</div>
                           <div className="font-semibold text-[var(--pm-text)] dark:text-white mt-0.5">{summary.projects}</div>
                        </div>
                        <div className="text-xs">
                           <div className="text-[var(--pm-on-surface-variant)] uppercase tracking-wider text-[10px]">Milestones</div>
                           <div className="font-semibold text-[var(--pm-text)] dark:text-white mt-0.5">{summary.milestones}</div>
                        </div>
                        <div className="text-xs">
                           <div className="text-[var(--pm-on-surface-variant)] uppercase tracking-wider text-[10px]">Tasks</div>
                           <div className="font-semibold text-[var(--pm-text)] dark:text-white mt-0.5">{summary.tasks}</div>
                        </div>
                        <div className="text-xs">
                           <div className="text-[var(--pm-on-surface-variant)] uppercase tracking-wider text-[10px]">Team Members</div>
                           <div className="font-semibold text-[var(--pm-text)] dark:text-white mt-0.5">{summary.members}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          
          <div className="pt-2 flex flex-col gap-2">
            <button 
              onClick={handleDemo}
              disabled={!selectedTemplate || demoLoading}
              className={`w-full p-3.5 rounded-xl font-medium text-sm flex justify-center items-center gap-2 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-surface-3 ${
                selectedTemplate 
                  ? 'bg-[var(--pm-tertiary)] text-[var(--pm-on-tertiary)] hover:opacity-90 shadow-md' 
                  : 'bg-surface-4 text-[var(--pm-on-surface-variant)] border border-border/50 cursor-not-allowed'
              }`}
            >
              {demoLoading ? (
                <>Building Simulator...</>
              ) : (
                <>
                  Create Demo Workspace <Zap className={`w-4 h-4 ${selectedTemplate ? 'text-[var(--pm-text)]' : 'opacity-50'}`} />
                </>
              )}
            </button>
            {demoLoading && !selectedTemplate && <p className="text-xs text-[var(--pm-primary)] animate-pulse text-center mt-1">Injecting demo topology...</p>}
            
            {selectedTemplate && (
              <button
                onClick={() => { setSelectedTemplate(null); setName(''); }}
                disabled={demoLoading}
                className="w-full p-3 rounded-xl font-medium text-sm text-[var(--pm-on-surface-variant)] hover:text-[var(--pm-text)] dark:text-white hover:bg-surface-4 border border-transparent transition-colors flex justify-center items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Return to Manual Setup
              </button>
            )}
          </div>
        </aside>
      </div>
    </ResolveLayout>
  );
}
