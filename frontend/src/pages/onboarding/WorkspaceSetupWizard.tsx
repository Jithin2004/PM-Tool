import { trackSupabaseOperation } from '../../core/observability/telemetry';
import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { ResolveLayout } from '../../app/layouts/ResolveLayout';
import { Check, Layers, Users, Zap, Briefcase, Plus, X, ArrowLeft, LayoutTemplate } from 'lucide-react';
import { EmailChipsInput, EmailChip } from '../../components/ui/EmailChipsInput';
import { ProjectChipsInput } from '../../components/ui/ProjectChipsInput';
import { sandboxSeedEngine } from '../../core/engines/sandboxSeedEngine';
import { clearLicense, onboardWorkspaceTransaction } from '../../lib/productKey';
import { supabase } from '../../lib/supabase';
import { sha256 } from '../../utils/cryptoUtils';
import { onboardingService, ONBOARDING_STEPS } from '../../services/onboardingService';
import { TemplatePreview, OperatingTemplate } from '../../components/setup/TemplatePreview';
import { navigate } from '../../lib/navigation';
const TEMPLATE_SUMMARIES: Record<string, { projects: number, milestones: number, tasks: number, members: number, recommendedFor: string }> = {
  'ERP Implementation': { projects: 3, milestones: 12, tasks: 45, members: 8, recommendedFor: 'Enterprise Transformation' },
  'Software Product Launch': { projects: 2, milestones: 8, tasks: 34, members: 5, recommendedFor: 'Product Teams' },
  'Government Digital Transformation': { projects: 4, milestones: 15, tasks: 62, members: 12, recommendedFor: 'Public Sector' },
  'Internal Operations Program': { projects: 2, milestones: 6, tasks: 28, members: 4, recommendedFor: 'Ops Teams' },
  'Client Delivery Agency': { projects: 5, milestones: 20, tasks: 85, members: 10, recommendedFor: 'Agencies & Consultancies' }
};

const roleMapping: Record<string, string[]> = {
  owner: ['Founder', 'CEO', 'COO', 'CTO'],
  admin: ['Director', 'Department Head', 'Operations Manager'],
  manager: ['Director', 'Department Head', 'Operations Manager', 'Engineering Lead', 'Design Lead'],
  employee: ['Operations Executive', 'Product Designer', 'UI Designer', 'Intern'],
  developer: ['Engineering Lead', 'Senior Software Engineer', 'Software Engineer', 'Junior Software Engineer', 'Intern'],
  finance: ['Finance Manager', 'Accountant'],
  hr: ['HR Manager', 'HR Executive'],
  client: ['Client Representative', 'External Stakeholder']
};

export function WorkspaceSetupWizard() {
  const { createWorkspace } = useWorkspace();
  const { profile, user } = useAuth();
  
  const [step, setStep] = useState(1);
  const [name, setName] = useState(sessionStorage.getItem('pending_workspace_name') || '');
  const [departments, setDepartments] = useState<string[]>([]);
  const [workingTimeFrom, setWorkingTimeFrom] = useState('09:00');
  const [workingTimeTo, setWorkingTimeTo] = useState('17:00');
  const [selectedOperatingTemplates, setSelectedOperatingTemplates] = useState<OperatingTemplate[]>([]);
  const [members, setMembers] = useState<EmailChip[]>([]);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);



  const handleFinish = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const pendingStr = sessionStorage.getItem('pendingLicenseActivation');
      let productKey = 'OFFLINE-LICENSE';
      if (pendingStr) {
        const parsed = JSON.parse(pendingStr);
        productKey = parsed.productKey || parsed.licenseId || 'OFFLINE-LICENSE';
      }

      const workspaceId = crypto.randomUUID();

      const payload = {
        productKey,
        workspaceId,
        workspaceName: name || 'My Workspace',
        executionMode: selectedOperatingTemplates.length > 0 ? selectedOperatingTemplates[0] : 'KANBAN',
        defaultLanes: 5,
        settings: { 
          companyName: name || 'My Workspace',
          workStart: workingTimeFrom,
          workEnd: workingTimeTo,
          workingTimeFrom: workingTimeFrom,
          workingTimeTo: workingTimeTo,
          workingDays: [1, 2, 3, 4, 5],
          lunchDuration: 60,
          timezone: 'UTC',
          attendanceEnabled: true,
          payrollEnabled: false,
          productivityFactor: 0.8,
          businessType: 'Software'
        },
        user: {
          id: user?.id,
          email: user?.email,
          full_name: profile?.full_name
        }
      };

      const result = await onboardWorkspaceTransaction(payload, session.access_token);
      
      if (result.success) {
        sessionStorage.removeItem('pendingLicenseActivation');
        sessionStorage.removeItem('pending_workspace_name');
        
        const createdId = workspaceId;
        if (departments.length > 0) {
          try {
            await trackSupabaseOperation('supabase_insert_departments', () => 
              supabase.from('departments').insert(
                departments.map(dept => ({
                  workspace_id: createdId,
                  name: dept
                }))
              )
            );
          } catch (e) {
            console.error('Failed to save departments', e);
          }
        }
        if (members.length > 0) {
          const { mapAuthorityToLegacyRole } = await import('../../core/types/workspace');
          
          let imported = 0;
          let failed = 0;
          let skipped = 0;
          let failReasons: string[] = [];

          const payloadUsers = members.map(m => {
            return {
              email: m.email,
              role: mapAuthorityToLegacyRole(m.authority),
              capabilities: m.functions,
              designation: m.designation || null,
              full_name: m.name || m.email.split('@')[0],
              department: null // Department is assigned later or if needed we can add it to EmailChip
            };
          });

          try {
            const { data: { session: invokeSession } } = await supabase.auth.getSession();
            if (!invokeSession) throw new Error("Not authenticated");

            const { data: result, error: invokeError } = await supabase.functions.invoke('provisioning', {
              body: {
                operation: 'bulk_invite_users',
                users: payloadUsers,
                source: 'onboarding'
              }
            });

            if (invokeError) {
              throw invokeError;
            }

            if (result?.success) {
              imported = result.results?.length || 0;
              failed = result.errors?.length || 0;
              failReasons = result.errors?.map((e: any) => `${e.email}: ${e.error}`) || [];
            } else {
              throw new Error(result?.error || 'Failed to bulk invite users');
            }
          } catch (err: any) {
            console.error("Bulk invite failed:", err);
            failed = members.length;
            failReasons.push(`API Error: ${err.message}`);
          }
          
          // Optionally show summary before redirect if there are failures
          if (failed > 0 || skipped > 0) {
            window.dispatchEvent(new CustomEvent('notify-toast', {
              detail: { 
                message: `Import Summary:\nImported: ${imported}\nSkipped: ${skipped}\nFailed: ${failed}\n\nReasons:\n${failReasons.join('\n')}`, 
                type: 'warning' 
              }
            }));
          }
        }

        // Persist onboarding state - mark setup complete
        await onboardingService.completeSetup(createdId);
        if (selectedOperatingTemplates.length > 0) {
          await onboardingService.saveTemplates(createdId, selectedOperatingTemplates);
        }

        // Force refresh session to immediately update JWT app_metadata claims
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.error('Failed to refresh session on finish onboarding:', refreshError);
        }

        navigate('/overview');
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const pendingStr = sessionStorage.getItem('pendingLicenseActivation');
      let productKey = 'OFFLINE-LICENSE';
      if (pendingStr) {
        const parsed = JSON.parse(pendingStr);
        productKey = parsed.productKey || parsed.licenseId || 'OFFLINE-LICENSE';
      }

      const workspaceId = crypto.randomUUID();

      const payload = {
        productKey,
        workspaceId,
        workspaceName: selectedTemplate,
        executionMode: 'KANBAN',
        defaultLanes: 5,
        settings: { companyName: selectedTemplate },
        user: {
          id: user?.id,
          email: user?.email,
          full_name: profile?.full_name
        }
      };

      const result = await onboardWorkspaceTransaction(payload, session.access_token);
      
      if (result.success) {
          sessionStorage.removeItem('pendingLicenseActivation');
          sessionStorage.removeItem('pending_workspace_name');
          await sandboxSeedEngine.seedSandboxEnvironment(workspaceId, profile!.id, selectedTemplate);
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

  const getHoursConfigured = () => {
    if (!workingTimeFrom || !workingTimeTo) return 0;
    const start = new Date(`2000-01-01T${workingTimeFrom}`);
    const end = new Date(`2000-01-01T${workingTimeTo}`);
    let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (diff < 0) diff += 24;
    return diff;
  };

  return (
    <ResolveLayout eyebrow="Onboarding">
      <div className="flex flex-col items-center justify-center w-full min-h-[80vh] py-8 px-4">
        <section className="premium-panel rounded-2xl p-8 font-geist w-full max-w-2xl">
          
          {/* Onboarding setup completion progress bar */}
          <div className="w-full h-1 bg-white/5 mb-6 rounded-full overflow-hidden">
            <div className="h-full bg-[var(--pm-primary)] transition-all duration-300" style={{ width: `${Math.round(((step - 1) / 5) * 100)}%` }}></div>
          </div>

          <div className="flex justify-between text-[10px] sm:text-xs font-mono uppercase tracking-widest text-[var(--pm-on-surface-variant)] mb-8 border-b border-border/50 pb-4">
            <div className="flex gap-2 sm:gap-4 flex-wrap">
              <span className={step >= 1 ? "text-[var(--pm-primary)] font-bold" : ""}>Details {step > 1 ? '✓' : '○'}</span>
              <span className={step >= 2 ? "text-[var(--pm-primary)] font-bold" : ""}>Departments {step > 2 ? '✓' : '○'}</span>
              <span className={step >= 3 ? "text-[var(--pm-primary)] font-bold" : ""}>Hours {step > 3 ? '✓' : '○'}</span>
              <span className={step >= 4 ? "text-[var(--pm-primary)] font-bold" : ""}>Templates {step > 4 ? '✓' : '○'}</span>
              <span className={step >= 5 ? "text-[var(--pm-primary)] font-bold" : ""}>Team {step > 5 ? '✓' : '○'}</span>
              <span className={step >= 6 ? "text-[var(--pm-primary)] font-bold" : ""}>Roles {step > 6 ? '✓' : '○'}</span>
              <span className={step >= 7 ? "text-[var(--pm-primary)] font-bold" : ""}>Launch {step > 7 ? '✓' : '○'}</span>
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
            <div className="mb-6 p-4 border border-[var(--signal-critical)] bg-[var(--signal-critical-bg)]/50 bg-red-500/10 rounded-lg animate-in fade-in">
              <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">!</span>
                {dbError.includes('license') || dbError.includes('activated') ? 'License Activation Failed' : 'Database Missing'}
              </h3>
              <p className="text-sm text-red-200 leading-relaxed whitespace-pre-wrap">
                {dbError}
              </p>
              {!dbError.includes('license') && !dbError.includes('activated') && (
                <p className="text-xs text-red-300 mt-2 font-mono">
                  Please copy the contents of <strong>RESOLVE_PM_PRODUCTION_MASTER_SCHEMA.sql</strong> and run it in your Supabase project's SQL Editor to create the necessary tables.
                </p>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <label className="block text-sm font-semibold">Step 1: Workspace Name</label>
              <input name="workspaceName" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 input-premium" placeholder="e.g. Acme Corp" />
            </div>
          )}
          
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <label className="block text-sm font-semibold">Step 2: Departments</label>
              <ProjectChipsInput
                value={departments}
                onChange={setDepartments}
                placeholder="E.g. Engineering, Sales (press Enter)"
                itemLabel="department"
                itemLabelPlural="departments"
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
                  <input type="time" value={workingTimeFrom} onChange={e => setWorkingTimeFrom(e.target.value)} className="w-full p-3 input-premium" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-text-tertiary mb-1">End Time</label>
                  <input type="time" value={workingTimeTo} onChange={e => setWorkingTimeTo(e.target.value)} className="w-full p-3 input-premium" />
                </div>
              </div>
              <div className="flex justify-between items-center mt-2 px-1 min-h-[20px]">
                <p className="text-[11px] text-[var(--pm-on-surface-variant)] italic">Used for capacity planning and availability tracking.</p>
                <span className="text-[11px] font-medium text-[var(--pm-on-surface-variant)] uppercase tracking-wide">
                  {getHoursConfigured()} HOURS CONFIGURED
                </span>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center gap-2 mb-1">
                <LayoutTemplate className="w-4 h-4 text-indigo-400" />
                <label className="block text-sm font-semibold">Step 4: Operating Templates</label>
              </div>
              <p className="text-[11px] text-[var(--pm-on-surface-variant)] italic mb-3">
                Choose how your team works. These configure your workflow views — no sample data is inserted.
              </p>
              <TemplatePreview
                selected={selectedOperatingTemplates}
                onChange={setSelectedOperatingTemplates}
              />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <label className="block text-sm font-semibold">Step 5: Invite Team (Optional)</label>
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

          {step === 6 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <label className="block text-sm font-semibold">Step 6: Assign Permissions & Roles</label>
              {members.length === 0 ? (
                <p className="text-sm text-[var(--pm-on-surface-variant)] italic">No team members added. You can skip this step.</p>
              ) : (
                <>
                  <div className="max-h-[60vh] overflow-y-auto space-y-4 border border-border/50 rounded-lg p-3 bg-surface-4">
                  {members.map((m, idx) => (
                    <div key={idx} className="flex flex-col gap-3 p-4 bg-surface-2 rounded-lg border border-border/60 shadow-sm">
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <span className="text-sm font-bold text-[var(--pm-on-surface)]">{m.email}</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-[var(--pm-on-surface-variant)] uppercase tracking-wider">Authority Level</label>
                          <select 
                            value={m.authority}
                            onChange={(e) => {
                              const newMembers = [...members];
                              newMembers[idx].authority = e.target.value as any;
                              newMembers[idx].designation = '';
                              setMembers(newMembers);
                            }}
                            className="input-premium w-full text-sm rounded px-3 py-2 outline-none"
                          >
                            <option value="owner">Owner</option>
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="employee">Employee</option>
                            <option value="developer">Developer</option>
                            <option value="finance">Finance</option>
                            <option value="hr">HR</option>
                            <option value="client">Client</option>
                          </select>
                          <p className="mt-1 text-[10px] font-mono-pm text-text-tertiary">
                            {m.authority === 'owner' && "Full workspace control"}
                            {m.authority === 'admin' && "Manage workspace settings and users"}
                            {m.authority === 'manager' && "Manage projects and team work"}
                            {m.authority === 'employee' && "Complete assigned work"}
                            {m.authority === 'developer' && "Build and complete technical tasks"}
                            {m.authority === 'finance' && "Manage money, invoices, and reports"}
                            {m.authority === 'hr' && "Manage people, attendance, and approvals"}
                            {m.authority === 'client' && "View shared progress"}
                          </p>
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-[var(--pm-on-surface-variant)] uppercase tracking-wider">Job Title (Designation)</label>
                          <select 
                            value={m.designation || ''}
                            disabled={!m.authority}
                            onChange={(e) => {
                              const newMembers = [...members];
                              newMembers[idx].designation = e.target.value;
                              setMembers(newMembers);
                            }}
                            className="input-premium w-full text-sm rounded px-3 py-2 outline-none disabled:opacity-50"
                          >
                            <option value="">Select Title...</option>
                            {m.authority && roleMapping[m.authority]?.map((title) => (
                              <option key={title} value={title}>{title}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2 mt-2">
                        <details className="group">
                          <summary className="text-[11px] font-semibold text-[var(--pm-on-surface-variant)] uppercase tracking-wider cursor-pointer list-none flex items-center gap-2">
                            Customize Permissions <span className="inline-block transition-transform group-open:rotate-180">▼</span>
                          </summary>
                          <div className="flex flex-wrap gap-2 mt-2 pl-2 border-l border-[var(--border-soft)]">
                            {['Projects', 'Engineering', 'Finance', 'PeopleOperations', 'Clients', 'Documents', 'Operations'].map((func) => (
                              <label key={func} className="flex items-center gap-1.5 cursor-pointer bg-surface-3 hover:bg-surface-4 border border-border/50 rounded-full px-3 py-1.5 text-xs transition-colors">
                                <input 
                                  type="checkbox"
                                  checked={m.functions.includes(func)}
                                  onChange={(e) => {
                                    const newMembers = [...members];
                                    if (e.target.checked) {
                                      newMembers[idx].functions = [...m.functions, func];
                                    } else {
                                      newMembers[idx].functions = m.functions.filter(f => f !== func);
                                    }
                                    setMembers(newMembers);
                                  }}
                                  className="w-3.5 h-3.5 rounded border-border text-[var(--pm-primary)] focus:ring-[var(--pm-primary)] bg-surface-1"
                                />
                                <span>{func.replace('PeopleOperations', 'People Ops')}</span>
                              </label>
                            ))}
                          </div>
                        </details>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-2 px-1 min-h-[20px]">
                  <span className="text-[11px] font-medium text-[var(--pm-on-surface-variant)] uppercase tracking-wide">
                    {members.length} {members.length !== 1 ? 'PROFILES' : 'PROFILE'} CONFIGURED
                  </span>
                </div>
              </>
              )}
            </div>
          )}
          
          {step === 7 && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-[var(--pm-on-surface)]">Ready for Launch</h3>
                <p className="text-sm text-[var(--pm-on-surface-variant)] mt-1">Review your company setup. Once created, you can immediately begin inviting your team and tracking projects.</p>
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
                
                {selectedOperatingTemplates.length > 0 && (
                  <div className="border-b border-border/50 pb-3">
                    <span className="text-xs font-mono uppercase text-[var(--pm-on-surface-variant)] block mb-2">Operating Templates</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedOperatingTemplates.map(t => (
                        <span key={t} className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full">{t.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
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
            <button disabled={step === 1} onClick={() => setStep(s => s - 1)} className="px-4 py-2 rounded btn-premium-secondary disabled:opacity-50 transition-colors">Back</button>
            {step < 7 ? (
              <button disabled={step === 1 && !name.trim()} onClick={() => setStep(s => s + 1)} className="px-4 py-2 rounded btn-premium-primary disabled:opacity-50 transition-colors">Next</button>
            ) : (
              <button onClick={handleFinish} disabled={loading} className="px-4 py-2 rounded btn-premium-success flex items-center gap-2 disabled:opacity-50 transition-colors font-medium">
                {loading ? 'Building...' : 'Complete Setup'} <Zap className="w-4 h-4 fill-white text-white" />
              </button>
            )}
          </div>
        </section>
      </div>
    </ResolveLayout>
  );
}


