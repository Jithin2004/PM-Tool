import React, { useMemo, useState } from 'react';
import { Check, Plus, X, Layers, GitBranch, Users, Hash, BadgeCheck } from 'lucide-react';
import { BUSINESS_TYPES, WORKFLOW_TEMPLATES, getTemplatesForBusiness, EXECUTION_MODES } from '../../constants/product';
import type { WorkflowTemplate } from '../../constants/product';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { predictEtaSync } from '../../services/etaService';
import type { BusinessType, WorkspaceSettings } from '../../types/workspace';
import { ResolveLayout } from '../../app/layouts/ResolveLayout';
import { supabase } from '../../lib/supabase';

const WORKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' }
];

const DEFAULT_SETTINGS: WorkspaceSettings = {
  businessType: 'Software',
  workStart: '09:00',
  workEnd: '17:00',
  lunchDuration: 60,
  workingDays: [1, 2, 3, 4, 5],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  attendanceEnabled: true,
  payrollEnabled: false,
  productivityFactor: 0.8,
  saturdayRule: 'off'
};

function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function WorkspaceSetupPage() {
  const { user, workspace, createWorkspace, updateWorkspaceSettings, error } = useWorkspace();
  const { refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [workspaceName, setWorkspaceName] = useState(workspace?.name || `${user?.email?.split('@')[0] || 'My'} Workspace`);
  const [settings, setSettings] = useState<WorkspaceSettings>(workspace?.settings || DEFAULT_SETTINGS);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invites, setInvites] = useState<string[]>([]);

  React.useEffect(() => {
    if (window.location.pathname !== '/onboarding/workspace') {
      window.history.replaceState(null, '', '/onboarding/workspace');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, []);

  const templateOptions = useMemo(() => getTemplatesForBusiness(settings.businessType), [settings.businessType]);

  const preview = useMemo(() => predictEtaSync({
    likely: 40,
    workWindow: settings,
    startDate: new Date()
  }), [settings]);

  const saveWorkspace = async () => {
    setSaving(true);
    setLocalError(null);

    try {
      if (workspace) {
        await updateWorkspaceSettings(settings);
      } else {
        await createWorkspace({
          name: workspaceName.trim() || 'Resolve Workspace',
          settings,
          templateId: selectedTemplate?.id,
          executionMode: selectedTemplate?.executionMode,
          defaultLanes: selectedTemplate?.lanes,
          workflowRules: {
            ceremonies: selectedTemplate?.ceremonies || [],
            teamStructure: selectedTemplate?.teamStructure || ''
          }
        });
        await refreshProfile();
      }
      setStep(5);
    } catch (err: any) {
      setLocalError(err?.message || 'Workspace setup failed.');
    } finally {
      setSaving(false);
    }
  };

  const addInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || invites.includes(email)) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLocalError("Invalid email format.");
      return;
    }

    setLocalError(null);
    setSaving(true);
    try {
      if (workspace?.id) {
        const { error: inviteError } = await supabase
          .from('invitations')
          .insert({
            email,
            workspace_id: workspace.id,
            role: 'developer', // Default invited role
            status: 'pending',
            invited_by: user?.id,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          });

        if (inviteError) {
          if (inviteError.code === '23505') {
            throw new Error("This email is already invited.");
          }
          throw inviteError;
        }
      }
      setInvites(prev => [...prev, email]);
      setInviteEmail('');
    } catch (err: any) {
      setLocalError(err?.message || "Failed to save invitation.");
    } finally {
      setSaving(false);
    }
  };

  const removeInvite = async (email: string) => {
    setLocalError(null);
    setSaving(true);
    try {
      if (workspace?.id) {
        await supabase
          .from('invitations')
          .delete()
          .eq('workspace_id', workspace.id)
          .eq('email', email);
      }
      setInvites(prev => prev.filter(value => value !== email));
    } catch (err: any) {
      setLocalError("Failed to revoke invitation.");
    } finally {
      setSaving(false);
    }
  };

  const toggleWorkday = (day: number) => {
    setSettings(prev => {
      const nextDays = prev.workingDays.includes(day)
        ? prev.workingDays.filter(value => value !== day)
        : [...prev.workingDays, day].sort((a, b) => a - b);

      const hasSaturday = nextDays.includes(6);
      return {
        ...prev,
        workingDays: nextDays.length > 0 ? nextDays : prev.workingDays,
        saturdayRule: hasSaturday ? (prev.saturdayRule === 'off' ? 'all' : prev.saturdayRule || 'all') : 'off'
      };
    });
  };

  return (
    <ResolveLayout eyebrow="Workspace Setup">
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.2em] text-white/45">Step {step} of 6</p>
              <h2 className="mt-2 text-2xl font-semibold">
                {step <= 4 ? 'Set up your workspace' : step === 5 ? 'Invite your team' : 'Create your first project'}
              </h2>
            </div>
          </div>

          {(localError || error) && (
            <div className="mb-5 border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {localError || error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <label className="block text-sm font-medium">
                Workspace Name
                <input
                  value={workspaceName}
                  onChange={event => setWorkspaceName(event.target.value)}
                  className="mt-2 h-12 w-full border border-white/10 bg-black px-4 text-white outline-none focus:border-white/40"
                />
              </label>

              <div>
                <label className="mb-3 block text-sm font-medium">Business Type</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {BUSINESS_TYPES.map(type => (
                    <button
                      key={type}
                      onClick={() => setSettings(prev => ({ ...prev, businessType: type as BusinessType }))}
                      className={`border px-4 py-3 text-left text-sm transition-colors ${settings.businessType === type ? 'border-white bg-white text-black' : 'border-white/10 bg-white/5 text-white/80 hover:border-white/25'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-white/70">
                Choose a workflow template for <strong>{settings.businessType}</strong>. This sets up your first board with the appropriate structure.
              </p>
              <div className="grid gap-3 max-h-[420px] overflow-y-auto pr-1">
                {templateOptions.map(tpl => {
                  const isSelected = selectedTemplate?.id === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => {
                        setSelectedTemplate(tpl);
                        setSettings(prev => ({
                          ...prev,
                          templateId: tpl.id,
                          executionMode: tpl.executionMode,
                          defaultLanes: tpl.lanes,
                          workflowRules: { ceremonies: tpl.ceremonies, teamStructure: tpl.teamStructure }
                        }));
                      }}
                      className={`w-full text-left border p-4 transition-all ${isSelected ? 'border-cyan-400 bg-cyan-950/20' : 'border-white/10 bg-white/5 hover:border-white/25'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-base font-semibold">{tpl.name}</h4>
                          <p className="mt-1 text-xs text-white/60 leading-relaxed">{tpl.description}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider border border-white/10 px-2 py-0.5 text-white/70">
                              <Layers className="w-3 h-3" />{tpl.lanes} lanes
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider border border-white/10 px-2 py-0.5 text-white/70">
                              <GitBranch className="w-3 h-3" />{tpl.executionMode}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider border border-white/10 px-2 py-0.5 text-white/70">
                              <Users className="w-3 h-3" />{tpl.teamStructure}
                            </span>
                          </div>
                          {tpl.ceremonies.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {tpl.ceremonies.map(c => (
                                <span key={c} className="text-[9px] font-mono bg-white/5 px-1.5 py-0.5 text-cyan-300/70">{c}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        {isSelected && <BadgeCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-1" />}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {tpl.badges.map(b => (
                          <span key={b} className="text-[9px] font-mono uppercase tracking-wider bg-white/10 px-2 py-0.5 text-white/60">{b}</span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Work Start
                <input type="time" value={settings.workStart} onChange={event => setSettings(prev => ({ ...prev, workStart: event.target.value }))} className="mt-2 h-12 w-full border border-white/10 bg-black px-4 text-white" />
              </label>
              <label className="text-sm font-medium">
                Work End
                <input type="time" value={settings.workEnd} onChange={event => setSettings(prev => ({ ...prev, workEnd: event.target.value }))} className="mt-2 h-12 w-full border border-white/10 bg-black px-4 text-white" />
              </label>
              <label className="text-sm font-medium">
                Lunch Duration
                <input type="number" min={0} value={settings.lunchDuration} onChange={event => setSettings(prev => ({ ...prev, lunchDuration: Number(event.target.value) || 0 }))} className="mt-2 h-12 w-full border border-white/10 bg-black px-4 text-white" />
              </label>
              <label className="text-sm font-medium">
                Timezone
                <input value={settings.timezone} onChange={event => setSettings(prev => ({ ...prev, timezone: event.target.value }))} className="mt-2 h-12 w-full border border-white/10 bg-black px-4 text-white" />
              </label>
              <label className="text-sm font-medium">
                Country
                <input value={settings.country || ''} onChange={event => setSettings(prev => ({ ...prev, country: event.target.value }))} placeholder="e.g. India" className="mt-2 h-12 w-full border border-white/10 bg-black px-4 text-white outline-none" />
              </label>
              <label className="text-sm font-medium">
                State/Region
                <input value={settings.region || ''} onChange={event => setSettings(prev => ({ ...prev, region: event.target.value }))} placeholder="e.g. Kerala" className="mt-2 h-12 w-full border border-white/10 bg-black px-4 text-white outline-none" />
              </label>
              <div className="sm:col-span-2">
                <label className="mb-3 block text-sm font-medium">Workdays</label>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {WORKDAYS.map(day => {
                    const active = settings.workingDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        onClick={() => toggleWorkday(day.value)}
                        className={`h-10 border text-sm ${active ? 'border-white bg-white text-black' : 'border-white/10 bg-white/5 text-white/70'}`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {settings.workingDays.includes(6) && (
                <div className="sm:col-span-2">
                  <label className="mb-3 block text-sm font-medium">Saturday Working Pattern</label>
                  <select
                    value={settings.saturdayRule || 'all'}
                    onChange={event => setSettings(prev => ({ ...prev, saturdayRule: event.target.value as any }))}
                    className="h-12 w-full border border-white/10 bg-black px-4 text-white focus:border-white/40 outline-none"
                  >
                    <option value="all">All Saturdays Working</option>
                    <option value="off">All Saturdays Off</option>
                    <option value="2nd_4th">2nd & 4th Saturday Off</option>
                    <option value="1st_3rd">1st & 3rd Saturday Off</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="mb-3 block text-sm font-medium">Workspace Shutdown Dates</label>
                <div className="space-y-3">
                  {(settings.shutdowns || []).map((shutdown, index) => (
                    <div key={index} className="flex items-center justify-between border border-white/10 bg-white/5 px-4 py-2 text-sm">
                      <div>
                        <span className="font-semibold text-white">{shutdown.name}</span>: {shutdown.start} to {shutdown.end}
                      </div>
                      <button onClick={() => setSettings(prev => ({
                        ...prev,
                        shutdowns: (prev.shutdowns || []).filter((_, i) => i !== index)
                      }))}>
                        <X className="h-4 w-4 text-white/60 hover:text-white" />
                      </button>
                    </div>
                  ))}
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Shutdown / Retreat Name"
                      id="shutdown-name"
                      className="h-12 flex-1 border border-white/10 bg-black px-4 text-sm text-white outline-none focus:border-white/40"
                    />
                    <input
                      type="date"
                      id="shutdown-start"
                      className="h-12 border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-white/40"
                    />
                    <input
                      type="date"
                      id="shutdown-end"
                      className="h-12 border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-white/40"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nameEl = document.getElementById('shutdown-name') as HTMLInputElement;
                        const startEl = document.getElementById('shutdown-start') as HTMLInputElement;
                        const endEl = document.getElementById('shutdown-end') as HTMLInputElement;
                        if (nameEl?.value && startEl?.value && endEl?.value) {
                          setSettings(prev => ({
                            ...prev,
                            shutdowns: [...(prev.shutdowns || []), { name: nameEl.value, start: startEl.value, end: endEl.value }]
                          }));
                          nameEl.value = '';
                          startEl.value = '';
                          endEl.value = '';
                        }
                      }}
                      className="h-12 border border-white/10 bg-white px-6 text-sm font-medium text-black hover:bg-white/90"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <label className="block text-sm font-medium">
                Productivity Factor
                <input
                  type="number"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={settings.productivityFactor}
                  onChange={event => setSettings(prev => ({ ...prev, productivityFactor: Number(event.target.value) || 0.8 }))}
                  className="mt-2 h-12 w-full border border-white/10 bg-black px-4 text-white"
                />
              </label>
              <label className="flex items-center justify-between border border-white/10 bg-white/5 p-4">
                Attendance Enabled
                <input type="checkbox" checked={settings.attendanceEnabled} onChange={event => setSettings(prev => ({ ...prev, attendanceEnabled: event.target.checked }))} />
              </label>
              <label className="flex items-center justify-between border border-white/10 bg-white/5 p-4">
                Payroll Enabled
                <input type="checkbox" checked={settings.payrollEnabled} onChange={event => setSettings(prev => ({ ...prev, payrollEnabled: event.target.checked }))} />
              </label>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={event => setInviteEmail(event.target.value)}
                  placeholder="teammate@company.com"
                  className="h-12 flex-1 border border-white/10 bg-black px-4 text-white outline-none focus:border-white/40"
                />
                <button onClick={addInvite} className="flex h-12 w-12 items-center justify-center border border-white/10 bg-white text-black">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {invites.map(email => (
                  <div key={email} className="flex items-center justify-between border border-white/10 bg-white/5 px-4 py-3 text-sm">
                    {email}
                    <button onClick={() => removeInvite(email)} disabled={saving}>
                      <X className="h-4 w-4 text-white/60" />
                    </button>
                  </div>
                ))}
                {invites.length === 0 && <p className="text-sm text-white/55">No invites added. You can skip this for now.</p>}
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="border border-white/10 bg-black/30 p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center bg-emerald-500/15 text-emerald-300">
                <Check className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-semibold">Workspace foundation is ready</h3>
              <p className="mt-3 text-sm leading-6 text-white/65">
                Your workspace is ready. You can now build projects, delegate tasks, track timelines, and sync offline in real-time.
              </p>
              {selectedTemplate && (
                <div className="mt-4 border border-white/10 bg-white/5 p-3 text-sm">
                  <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">Template</span>
                  <p className="mt-1 font-semibold">{selectedTemplate.name}</p>
                  <p className="text-xs text-white/60 mt-0.5">{selectedTemplate.executionMode} · {selectedTemplate.lanes} lanes · {selectedTemplate.teamStructure}</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <button
              disabled={step === 1 || saving}
              onClick={() => setStep(prev => Math.max(1, prev - 1))}
              className="border border-white/10 px-4 py-2 text-sm text-white/80 disabled:opacity-40"
            >
              Back
            </button>

            {step < 4 && (
              <button
                onClick={() => {
                  if (step === 2 && !selectedTemplate) return;
                  setStep(prev => prev + 1);
                }}
                className={`bg-white px-4 py-2 text-sm font-medium text-black ${step === 2 && !selectedTemplate ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                Next
              </button>
            )}

            {step === 4 && (
              <button disabled={saving} onClick={saveWorkspace} className="bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Workspace'}
              </button>
            )}

            {step === 5 && (
              <button onClick={() => setStep(6)} className="bg-white px-4 py-2 text-sm font-medium text-black">
                {invites.length > 0 ? 'Continue' : 'Skip'}
              </button>
            )}

            {step === 6 && (
              <button onClick={() => navigate('/')} className="bg-white px-4 py-2 text-sm font-medium text-black">
                Go to Dashboard
              </button>
            )}
          </div>
        </section>

        <aside className="border border-white/10 bg-white/[0.03] p-6">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-white/45">Prediction Preview</p>
          <h3 className="mt-3 text-lg font-semibold">A 40 hour project finishes around</h3>
          <p className="mt-4 text-3xl font-semibold">{preview.predictedCompletion.toLocaleDateString()}</p>
          <dl className="mt-6 space-y-3 text-sm text-white/70">
            <div className="flex justify-between"><dt>Daily capacity</dt><dd>{preview.dailyCapacityHours}h</dd></div>
            <div className="flex justify-between"><dt>Confidence</dt><dd>{preview.confidence}%</dd></div>
            <div className="flex justify-between"><dt>Risk</dt><dd className="capitalize">{preview.risk}</dd></div>
            <div className="flex justify-between"><dt>Workspace</dt><dd>{workspaceName || 'Untitled'}</dd></div>
          </dl>
          {selectedTemplate && (
            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-xs font-mono uppercase tracking-[0.2em] text-cyan-400">Workflow Template</p>
              <div className="mt-3 space-y-2 text-sm text-white/70">
                <div className="flex justify-between"><dt>Template</dt><dd className="text-white font-medium">{selectedTemplate.name}</dd></div>
                <div className="flex justify-between"><dt>Execution Mode</dt><dd className="text-cyan-300 font-mono text-xs">{selectedTemplate.executionMode}</dd></div>
                <div className="flex justify-between"><dt>Default Lanes</dt><dd>{selectedTemplate.lanes}</dd></div>
                <div className="flex justify-between items-start"><dt>Team</dt><dd className="text-right text-xs">{selectedTemplate.teamStructure}</dd></div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </ResolveLayout>
  );
}
