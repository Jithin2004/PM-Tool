import { trackSupabaseOperation } from '../../core/observability/telemetry';
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
import { sha256 } from '../../utils/cryptoUtils';
import { navigateTo } from '../../core/auth/postAuthRedirect';
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
  const [name, setName] = useState(sessionStorage.getItem('pending_workspace_name') || '');
  const [departments, setDepartments] = useState<string[]>([]);
  const [workingTimeFrom, setWorkingTimeFrom] = useState('09:00');
  const [workingTimeTo, setWorkingTimeTo] = useState('17:00');
  const [members, setMembers] = useState<EmailChip[]>([]);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const attachLicenseIfPending = async (workspaceId: string, userId: string): Promise<boolean> => {
    try {
      console.log('[LICENSE ATTACH START]', sessionStorage.getItem('pendingLicenseActivation'));
      const pendingStr = sessionStorage.getItem('pendingLicenseActivation');
      if (!pendingStr) return true;

      const parsed = JSON.parse(pendingStr);
      const productKeyStr = parsed.productKey || parsed.licenseId || 'OFFLINE-LICENSE';
      const rawPlan = (parsed.plan || '').toLowerCase();
      const planType = rawPlan === 'enterprise' ? 'enterprise' : rawPlan === 'premium' ? 'premium' : 'standard';
      const seats = parsed.seats || 10;
      const validatedAt = parsed.validatedAt || new Date().toISOString();
      const supportExpiryDate = parsed.supportExpiry ? new Date(parsed.supportExpiry).toISOString() : null;

      // Hash raw product key before database insertion/update
      const hashedKey = await sha256(productKeyStr);

      // Check if license already exists
      const { data: existingLicense } = await supabase
        .from('workspace_license')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      let queryResult;
      if (existingLicense) {
        queryResult = await supabase
          .from('workspace_license')
          .update({
            license_key_hash: hashedKey,
            activation_date: validatedAt,
            allowed_users: seats,
            license_type: planType,
            support_until: supportExpiryDate
          })
          .eq('workspace_id', workspaceId);
      } else {
        queryResult = await supabase
          .from('workspace_license')
          .insert({
            workspace_id: workspaceId,
            license_key_hash: hashedKey,
            activation_date: validatedAt,
            allowed_users: seats,
            license_type: planType,
            support_until: supportExpiryDate
          });
      }

      console.log('[LICENSE ATTACH RESULT]', { data: queryResult.data, error: queryResult.error });

      if (queryResult.error) {
        console.error('License attachment query error:', queryResult.error);
        return false;
      }

      // Cleanup on success
      sessionStorage.removeItem('pendingLicenseActivation');
      sessionStorage.removeItem('pending_workspace_name');
      return true;
    } catch (e) {
      console.error('License attachment failed:', e);
      return false;
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const created = await createWorkspace({
        name: name || 'My Workspace',
        settings: { 
          companyName: name || 'My Workspace',
          workStart: workingTimeFrom,
          workEnd: workingTimeTo,
          workingTimeFrom: workingTimeFrom, // Keep for backward compatibility
          workingTimeTo: workingTimeTo, // Keep for backward compatibility
          workingDays: [1, 2, 3, 4, 5],
          lunchDuration: 60,
          timezone: 'UTC',
          attendanceEnabled: true,
          payrollEnabled: false,
          productivityFactor: 0.8,
          businessType: 'Software'
        } as any
      });
      if (created) {
        if (departments.length > 0) {
          try {
            await trackSupabaseOperation('supabase_insert_departments', () => 
              supabase.from('departments').insert(
                departments.map(dept => ({
                  workspace_id: created.id,
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
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const response = await fetch(`${(import.meta.env.PROD ? (() => { if (!import.meta.env.VITE_API_URL) throw new Error("Backend URL missing"); return import.meta.env.VITE_API_URL; })() : (import.meta.env.VITE_API_URL || 'http://localhost:5001'))}/api/bulk-invite`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                users: payloadUsers,
                source: 'onboarding'
              })
            });

            const result = await response.json();
            if (response.ok) {
              imported = result.results?.length || 0;
              failed = result.errors?.length || 0;
              failReasons = result.errors?.map((e: any) => `${e.email}: ${e.error}`) || [];
            } else {
              throw new Error(result.error || 'Failed to bulk invite users');
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
        const licenseSuccess = await attachLicenseIfPending(created.id, user?.id || '');
        if (!licenseSuccess) {
          setDbError("Workspace created but license activation failed. Please retry activation.");
          setLoading(false);
          return;
        }
        await refreshProfile();
        navigateTo('/overview');
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
        const licenseSuccess = await attachLicenseIfPending(ws.id, user?.id || '');
        if (!licenseSuccess) {
          setDbError("Workspace created but license activation failed. Please retry activation.");
          setDemoLoading(false);
          return;
        }
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
      <div className="grid gap-8 lg:grid-cols-2 max-w-5xl mx-auto items-start">
        <section className="premium-panel rounded-2xl p-8 font-geist">
          
          {/* Onboarding setup completion progress bar */}
          <div className="w-full h-1 bg-white/5 mb-6 rounded-full overflow-hidden">
            <div className="h-full bg-[var(--pm-primary)] transition-all duration-300" style={{ width: `${Math.round(((step - 1) / 5) * 100)}%` }}></div>
          </div>

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
            <div className="mb-6 p-4 border border-[var(--signal-critical)] bg-[var(--signal-critical-bg)]/50 bg-red-500/10 rounded-lg animate-in fade-in">
              <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">!</span>
                {dbError.includes('license') ? 'License Activation Failed' : 'Database Missing'}
              </h3>
              <p className="text-sm text-red-200 leading-relaxed">
                {dbError}
              </p>
              {!dbError.includes('license') && (
                <p className="text-xs text-red-300 mt-2 font-mono">
                  Please copy the contents of <strong>RESOLVE_PM_PRODUCTION_MASTER_SCHEMA.sql</strong> and run it in your Supabase project's SQL Editor to create the necessary tables.
                </p>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <label className="block text-sm font-semibold">Step 1: Workspace Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full p-3 input-premium" placeholder="e.g. Acme Corp" />
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
              <label className="block text-sm font-semibold">Step 5: Assign Permissions & Roles</label>
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
                              setMembers(newMembers);
                            }}
                            className="input-premium w-full text-sm rounded px-3 py-2 outline-none"
                          >
                            <option value="admin">Workspace Admin</option>
                            <option value="manager">Manager</option>
                            <option value="member">Member</option>
                            <option value="external">External / Client</option>
                          </select>
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-[var(--pm-on-surface-variant)] uppercase tracking-wider">Job Title (Designation)</label>
                          <select 
                            value={m.designation}
                            onChange={(e) => {
                              const newMembers = [...members];
                              newMembers[idx].designation = e.target.value;
                              setMembers(newMembers);
                            }}
                            className="input-premium w-full text-sm rounded px-3 py-2 outline-none"
                          >
                            <option value="">Select Title...</option>
                            <optgroup label="Leadership">
                              <option value="Founder">Founder</option>
                              <option value="CEO">CEO</option>
                              <option value="COO">COO</option>
                              <option value="CTO">CTO</option>
                              <option value="Director">Director</option>
                              <option value="Department Head">Department Head</option>
                            </optgroup>
                            <optgroup label="Engineering">
                              <option value="Engineering Lead">Engineering Lead</option>
                              <option value="Senior Software Engineer">Senior Software Engineer</option>
                              <option value="Software Engineer">Software Engineer</option>
                              <option value="Junior Software Engineer">Junior Software Engineer</option>
                              <option value="Intern">Intern</option>
                            </optgroup>
                            <optgroup label="Design">
                              <option value="Product Designer">Product Designer</option>
                              <option value="UI Designer">UI Designer</option>
                              <option value="Design Lead">Design Lead</option>
                            </optgroup>
                            <optgroup label="Finance & People">
                              <option value="Finance Manager">Finance Manager</option>
                              <option value="Accountant">Accountant</option>
                              <option value="HR Manager">HR Manager</option>
                              <option value="HR Executive">HR Executive</option>
                            </optgroup>
                            <optgroup label="Operations">
                              <option value="Operations Manager">Operations Manager</option>
                              <option value="Operations Executive">Operations Executive</option>
                            </optgroup>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2 mt-2">
                        <label className="text-[11px] font-semibold text-[var(--pm-on-surface-variant)] uppercase tracking-wider">Functional Responsibilities</label>
                        <div className="flex flex-wrap gap-2">
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
          
          {step === 6 && (
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
                
                <div className="flex justify-between items-center pb-1">
                  <span className="text-xs font-mono uppercase text-[var(--pm-on-surface-variant)]">Template</span>
                  <span className="font-semibold text-[var(--pm-on-surface)]">Manual Configuration</span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <button disabled={step === 1 || selectedTemplate !== null} onClick={() => setStep(s => s - 1)} className="px-4 py-2 rounded btn-premium-secondary disabled:opacity-50 transition-colors">Back</button>
            {step < 6 ? (
              <button disabled={selectedTemplate !== null || (step === 1 && !name.trim())} onClick={() => setStep(s => s + 1)} className="px-4 py-2 rounded btn-premium-primary disabled:opacity-50 transition-colors">Next</button>
            ) : (
              <button onClick={handleFinish} disabled={loading || selectedTemplate !== null} className="px-4 py-2 rounded btn-premium-success flex items-center gap-2 disabled:opacity-50 transition-colors font-medium">
                {loading ? 'Building...' : 'Complete Setup'} <Zap className="w-4 h-4 fill-white text-white" />
              </button>
            )}
          </div>
        </section>

        <aside className="premium-panel rounded-2xl p-8 font-geist h-fit space-y-6 lg:sticky top-8">
          <h3 className="font-semibold text-[var(--pm-on-surface)] flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400"/> Instant Demo Workspaces</h3>
          <p className="text-xs text-[var(--pm-on-surface-variant)]">Bypass manual configuration and instantiate a fully-loaded enterprise demo environment.</p>
          
          <div className="space-y-3">
            {Object.keys(TEMPLATE_SUMMARIES).map(type => {
              const isSelected = selectedTemplate === type;
              const summary = TEMPLATE_SUMMARIES[type];
              
              return (
                <button 
                  key={type} 
                  onClick={() => toggleTemplate(type)} 
                  disabled={demoLoading} 
                  className={`w-full p-4 border rounded-xl text-left flex flex-col group transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[#080c19] ${
                    isSelected 
                      ? 'border-purple-500 bg-purple-500/10 shadow-sm ring-1 ring-purple-500/50' 
                      : 'border-[var(--border-soft)] hover:border-purple-500/70 bg-[var(--surface-glass)] hover:bg-[var(--surface-hover)]'
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
                           <div className="font-semibold text-[var(--pm-text)] text-[var(--text-primary)] mt-0.5">{summary.projects}</div>
                        </div>
                        <div className="text-xs">
                           <div className="text-[var(--pm-on-surface-variant)] uppercase tracking-wider text-[10px]">Milestones</div>
                           <div className="font-semibold text-[var(--pm-text)] text-[var(--text-primary)] mt-0.5">{summary.milestones}</div>
                        </div>
                        <div className="text-xs">
                           <div className="text-[var(--pm-on-surface-variant)] uppercase tracking-wider text-[10px]">Tasks</div>
                           <div className="font-semibold text-[var(--pm-text)] text-[var(--text-primary)] mt-0.5">{summary.tasks}</div>
                        </div>
                        <div className="text-xs">
                           <div className="text-[var(--pm-on-surface-variant)] uppercase tracking-wider text-[10px]">Team Members</div>
                           <div className="font-semibold text-[var(--pm-text)] text-[var(--text-primary)] mt-0.5">{summary.members}</div>
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
              className={`w-full p-3.5 rounded-xl font-semibold text-sm flex justify-center items-center gap-2 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-[#080c19] ${
                selectedTemplate 
                  ? 'btn-premium-primary cursor-pointer' 
                  : 'bg-[var(--surface-glass)] text-[var(--text-secondary)] border border-[var(--border-soft)] cursor-not-allowed'
              }`}
            >
              {demoLoading ? (
                <>Building Environment...</>
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
                className="w-full p-3 rounded-xl font-medium text-sm text-[var(--pm-on-surface-variant)] hover:text-[var(--pm-text)] text-[var(--text-primary)] hover:bg-surface-4 border border-transparent transition-colors flex justify-center items-center gap-2"
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
