import React, { useMemo, useState, useEffect } from 'react';
import { Check, Plus, X, Layers, GitBranch, Users, Hash, BadgeCheck, CalendarDays } from 'lucide-react';
import { BUSINESS_TYPES, WORKFLOW_TEMPLATES, getTemplatesForBusiness, EXECUTION_MODES } from '../../constants/product';
import type { WorkflowTemplate } from '../../constants/product';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { predictEtaSync } from '../../services/etaService';
import { holidaySourceService } from '../../services/holidaySourceService';
import type { BusinessType, WorkspaceSettings } from '../../types/workspace';
import { ResolveLayout } from '../../app/layouts/ResolveLayout';
import { supabase } from '../../lib/supabase';
import { COUNTRIES, getCountryByCode } from '../../data/countries';
import type { DerivedHoliday } from '../../utils/holidays';

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
  const [previewHolidays, setPreviewHolidays] = useState<DerivedHoliday[]>([]);
  const [ignoredHolidayDates, setIgnoredHolidayDates] = useState<Set<string>>(new Set());
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (window.location.pathname !== '/onboarding/workspace') {
      window.history.replaceState(null, '', '/onboarding/workspace');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, []);

  useEffect(() => {
    if (step === 4 && settings.country && previewHolidays.length === 0 && !previewLoading) {
      setPreviewLoading(true);
      const year = new Date().getFullYear();
      Promise.all([
        holidaySourceService.fetchHolidays(settings.country, settings.region || '', year),
        holidaySourceService.fetchHolidays(settings.country, settings.region || '', year + 1)
      ]).then(([thisYear, nextYear]) => {
        setPreviewHolidays([...thisYear, ...nextYear]);
      }).catch(() => {
        setPreviewHolidays([]);
      }).finally(() => {
        setPreviewLoading(false);
      });
    }
  }, [step, settings.country, settings.region]);

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
      let wsId = workspace?.id;
      if (workspace) {
        await updateWorkspaceSettings(settings);
        wsId = workspace.id;
      } else {
        const created = await createWorkspace({
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
        wsId = created.id;
        await refreshProfile();
      }

      if (ignoredHolidayDates.size > 0 && wsId) {
        const ignoreList = Array.from(ignoredHolidayDates);
        const { data: toRemove } = await supabase
          .from('calendar_events')
          .select('id')
          .eq('workspace_id', wsId)
          .in('event_type', ['holiday', 'festival'])
          .eq('auto_generated', true)
          .is('deleted_at', null);
        if (toRemove) {
          const idsToRemove = toRemove.filter(e => {
            const d = (e as any).start_date?.split('T')[0] || '';
            return ignoreList.includes(d);
          }).map(e => e.id);
          if (idsToRemove.length > 0) {
            await supabase.from('calendar_events')
              .update({ deleted_at: new Date().toISOString() })
              .in('id', idsToRemove);
          }
        }
      }

      setStep(6);
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
        <section className="border border-border bg-surface-3 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.2em] text-text-tertiary">Step {step} of 7</p>
              <h2 className="mt-2 text-2xl font-semibold">
                {step <= 5 ? 'Set up your workspace' : step === 6 ? 'Invite your team' : 'Create your first project'}
              </h2>
            </div>
          </div>

          {(localError || error) && (
            <div className="mb-5 border border-red-500/30 bg-signal-critical-bg p-3 text-sm text-red-200">
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
                  className="mt-2 h-12 w-full border border-border bg-bg px-4 text-text-primary outline-none focus:border-white/40"
                />
              </label>

              <div>
                <label className="mb-3 block text-sm font-medium">Business Type</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {BUSINESS_TYPES.map(type => (
                    <button
                      key={type}
                      onClick={() => setSettings(prev => ({ ...prev, businessType: type as BusinessType }))}
                      className={`border px-4 py-3 text-left text-sm transition-colors ${settings.businessType === type ? 'border-accent-primary bg-accent-primary/10 text-text-primary' : 'border-border bg-white/5 text-text-secondary hover:border-white/25'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-sm font-medium">
                Country <span className="text-signal-critical">*</span>
                <select
                  value={settings.country || ''}
                  onChange={event => {
                    setSettings(prev => ({ ...prev, country: event.target.value, region: '' }));
                    setIgnoredHolidayDates(new Set());
                    setPreviewHolidays([]);
                  }}
                  className="mt-2 h-12 w-full border border-border bg-bg px-4 text-text-primary outline-none focus:border-white/40"
                >
                  <option value="">Select country</option>
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
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
                      className={`w-full text-left border p-4 transition-all ${isSelected ? 'border-accent-primary bg-accent-primary/5' : 'border-border bg-white/5 hover:border-white/25'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-base font-semibold">{tpl.name}</h4>
                          <p className="mt-1 text-xs text-text-tertiary leading-relaxed">{tpl.description}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider border border-border px-2 py-0.5 text-text-secondary">
                              <Layers className="w-3 h-3" />{tpl.lanes} lanes
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider border border-border px-2 py-0.5 text-text-secondary">
                              <GitBranch className="w-3 h-3" />{tpl.executionMode}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider border border-border px-2 py-0.5 text-text-secondary">
                              <Users className="w-3 h-3" />{tpl.teamStructure}
                            </span>
                          </div>
                          {tpl.ceremonies.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {tpl.ceremonies.map(c => (
                                <span key={c} className="text-[9px] font-mono bg-white/5 px-1.5 py-0.5 text-accent-secondary/70">{c}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        {isSelected && <BadgeCheck className="w-5 h-5 text-accent-primary shrink-0 mt-1" />}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {tpl.badges.map(b => (
                          <span key={b} className="text-[9px] font-mono uppercase tracking-wider bg-white/10 px-2 py-0.5 text-text-tertiary">{b}</span>
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
                <input type="time" value={settings.workStart} onChange={event => setSettings(prev => ({ ...prev, workStart: event.target.value }))} className="mt-2 h-12 w-full border border-border bg-bg px-4 text-text-primary" />
              </label>
              <label className="text-sm font-medium">
                Work End
                <input type="time" value={settings.workEnd} onChange={event => setSettings(prev => ({ ...prev, workEnd: event.target.value }))} className="mt-2 h-12 w-full border border-border bg-bg px-4 text-text-primary" />
              </label>
              <label className="text-sm font-medium">
                Lunch Duration
                <input type="number" min={0} value={settings.lunchDuration} onChange={event => setSettings(prev => ({ ...prev, lunchDuration: Number(event.target.value) || 0 }))} className="mt-2 h-12 w-full border border-border bg-bg px-4 text-text-primary" />
              </label>
              <label className="text-sm font-medium">
                Timezone
                <input value={settings.timezone} onChange={event => setSettings(prev => ({ ...prev, timezone: event.target.value }))} className="mt-2 h-12 w-full border border-border bg-bg px-4 text-text-primary" />
              </label>
              {(() => {
                const countryData = getCountryByCode(settings.country || '');
                return countryData && countryData.states.length > 0 ? (
                  <label className="text-sm font-medium">
                    State/Region
                    <select
                      value={settings.region || ''}
                      onChange={event => setSettings(prev => ({ ...prev, region: event.target.value }))}
                      className="mt-2 h-12 w-full border border-border bg-bg px-4 text-text-primary outline-none focus:border-white/40"
                    >
                      <option value="">Select state/region</option>
                      {countryData.states.map(s => (
                        <option key={s.code} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="text-sm font-medium">
                    State/Region
                    <input
                      value={settings.region || ''}
                      onChange={event => setSettings(prev => ({ ...prev, region: event.target.value }))}
                      placeholder="Optional"
                      className="mt-2 h-12 w-full border border-border bg-bg px-4 text-text-primary outline-none"
                    />
                  </label>
                );
              })()}
              <label className="text-sm font-medium">
                City
                <input
                  value={settings.city || ''}
                  onChange={event => setSettings(prev => ({ ...prev, city: event.target.value }))}
                  placeholder="Optional"
                  className="mt-2 h-12 w-full border border-border bg-bg px-4 text-text-primary outline-none"
                />
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
                        className={`h-10 border text-sm ${active ? 'border-accent-primary bg-accent-primary/10 text-text-primary' : 'border-border bg-white/5 text-text-secondary'}`}
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
                    className="h-12 w-full border border-border bg-bg px-4 text-text-primary focus:border-white/40 outline-none"
                  >
                    <option value="all">All Saturdays Working</option>
                    <option value="off">All Saturdays Off</option>
                    <option value="2nd_4th">2nd & 4th Saturday Off</option>
                    <option value="1st_3rd">1st & 3rd Saturday Off</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              )}

            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <p className="text-sm text-text-secondary">
                Review holidays detected for <strong>{settings.country}{settings.region ? ` / ${settings.region}` : ''}</strong>.
                Uncheck any holidays that do not apply to your workspace. They can be re-enabled later from Settings.
              </p>

              {previewLoading && (
                <div className="flex items-center gap-3 py-8 text-sm text-text-tertiary">
                  <div className="h-4 w-4 animate-spin rounded-full border border-white/30 border-t-white" />
                  Loading holidays...
                </div>
              )}

              {!previewLoading && previewHolidays.length === 0 && settings.country && (
                <div className="border border-border bg-white/5 p-6 text-center text-sm text-text-tertiary">
                  <CalendarDays className="mx-auto mb-3 h-8 w-8 opacity-40" />
                  <p>No holidays found for {settings.country}{settings.region ? ` / ${settings.region}` : ''}.</p>
                  <p className="mt-1 text-xs text-text-quaternary">Holiday coverage is limited to countries with registered providers.</p>
                </div>
              )}

              {!previewLoading && previewHolidays.length > 0 && (
                <div className="divide-y divide-white/5 border border-border max-h-[360px] overflow-y-auto">
                  {previewHolidays.map(h => {
                    const dateStr = h.date;
                    const isIgnored = ignoredHolidayDates.has(dateStr);
                    return (
                      <label key={dateStr} className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors cursor-pointer hover:bg-surface-3 ${isIgnored ? 'opacity-40' : ''}`}>
                        <input
                          type="checkbox"
                          checked={!isIgnored}
                          onChange={() => {
                            setIgnoredHolidayDates(prev => {
                              const next = new Set(prev);
                              if (next.has(dateStr)) next.delete(dateStr);
                              else next.add(dateStr);
                              return next;
                              //
                            });
                          }}
                          className="accent-accent-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{h.name}</span>
                          <span className="ml-2 text-xs text-text-tertiary">{dateStr}</span>
                        </div>
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border ${h.type === 'public' ? 'border-border text-signal-warning bg-signal-warning-bg' : h.type === 'festival' ? 'border-border text-accent-secondary bg-surface-3' : 'border-border text-signal-info bg-surface-3'}`}>
                          {h.type}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {!settings.country && (
                <div className="border border-border bg-white/5 p-6 text-center text-sm text-text-tertiary">
                  <CalendarDays className="mx-auto mb-3 h-8 w-8 opacity-40" />
                  <p>Select a country in step 1 to preview applicable holidays.</p>
                </div>
              )}

              {previewHolidays.length > 0 && (
                <p className="text-xs text-text-quaternary">
                  {previewHolidays.length - ignoredHolidayDates.size} of {previewHolidays.length} holidays will be imported.
                  Ignored holidays can be re-enabled later from the Calendar Intelligence panel.
                </p>
              )}
            </div>
          )}

          {step === 5 && (
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
                  className="mt-2 h-12 w-full border border-border bg-bg px-4 text-text-primary"
                />
              </label>
              <label className="flex items-center justify-between border border-border bg-white/5 p-4">
                Attendance Enabled
                <input type="checkbox" checked={settings.attendanceEnabled} onChange={event => setSettings(prev => ({ ...prev, attendanceEnabled: event.target.checked }))} />
              </label>
              <label className="flex items-center justify-between border border-border bg-white/5 p-4">
                Payroll Enabled
                <input type="checkbox" checked={settings.payrollEnabled} onChange={event => setSettings(prev => ({ ...prev, payrollEnabled: event.target.checked }))} />
              </label>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-5">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={event => setInviteEmail(event.target.value)}
                  placeholder="teammate@company.com"
                  className="h-12 flex-1 border border-border bg-bg px-4 text-text-primary outline-none focus:border-white/40"
                />
                <button onClick={addInvite} className="flex h-12 w-12 items-center justify-center border border-accent-primary bg-accent-primary hover:bg-accent-primary/90 text-white transition-colors cursor-pointer">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {invites.map(email => (
                  <div key={email} className="flex items-center justify-between border border-border bg-white/5 px-4 py-3 text-sm">
                    {email}
                    <button onClick={() => removeInvite(email)} disabled={saving}>
                      <X className="h-4 w-4 text-text-tertiary" />
                    </button>
                  </div>
                ))}
                {invites.length === 0 && <p className="text-sm text-text-tertiary">No invites added. You can skip this for now.</p>}
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="border border-border bg-bg p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center bg-emerald-500/15 text-emerald-300">
                <Check className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-semibold">Workspace foundation is ready</h3>
              <p className="mt-3 text-sm leading-6 text-text-tertiary">
                Your workspace is ready. You can now build projects, delegate tasks, track timelines, and sync offline in real-time.
              </p>
              {selectedTemplate && (
                <div className="mt-4 border border-border bg-white/5 p-3 text-sm">
                  <span className="text-xs font-mono uppercase tracking-wider text-accent-primary">Template</span>
                  <p className="mt-1 font-semibold">{selectedTemplate.name}</p>
                  <p className="text-xs text-text-tertiary mt-0.5">{selectedTemplate.executionMode} · {selectedTemplate.lanes} lanes · {selectedTemplate.teamStructure}</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <button
              disabled={step === 1 || saving}
              onClick={() => setStep(prev => Math.max(1, prev - 1))}
              className="border border-border px-4 py-2 text-sm text-text-secondary disabled:opacity-40 cursor-pointer"
            >
              Back
            </button>

            {step < 5 && (
              <button
                onClick={() => {
                  if (step === 2 && !selectedTemplate) return;
                  if (step === 4 && !settings.country) return;
                  setStep(prev => prev + 1);
                }}
                className={`bg-accent-primary hover:bg-accent-primary/90 px-4 py-2 text-sm font-medium text-white transition-colors cursor-pointer ${step === 2 && !selectedTemplate ? 'opacity-40 cursor-not-allowed' : ''} ${step === 4 && !settings.country ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {step === 4 ? 'Skip Preview' : 'Next'}
              </button>
            )}

            {step === 5 && (
              <button disabled={saving} onClick={saveWorkspace} className="bg-accent-primary hover:bg-accent-primary/90 px-4 py-2 text-sm font-medium text-white transition-colors cursor-pointer disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Workspace'}
              </button>
            )}

            {step === 6 && (
              <button onClick={() => setStep(7)} className="bg-accent-primary hover:bg-accent-primary/90 px-4 py-2 text-sm font-medium text-white transition-colors cursor-pointer">
                {invites.length > 0 ? 'Continue' : 'Skip'}
              </button>
            )}

            {step === 7 && (
              <button onClick={() => navigate('/')} className="bg-accent-primary hover:bg-accent-primary/90 px-4 py-2 text-sm font-medium text-white transition-colors cursor-pointer">
                Go to Dashboard
              </button>
            )}
          </div>
        </section>

        <aside className="border border-border bg-surface-3 p-6">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-text-tertiary">Prediction Preview</p>
          <h3 className="mt-3 text-lg font-semibold">A 40 hour project finishes around</h3>
          <p className="mt-4 text-3xl font-semibold">{preview.predictedCompletion.toLocaleDateString()}</p>
          <dl className="mt-6 space-y-3 text-sm text-text-secondary">
            <div className="flex justify-between"><dt>Daily capacity</dt><dd>{preview.dailyCapacityHours}h</dd></div>
            <div className="flex justify-between"><dt>Confidence</dt><dd>{preview.confidence}%</dd></div>
            <div className="flex justify-between"><dt>Risk</dt><dd className="capitalize">{preview.risk}</dd></div>
            <div className="flex justify-between"><dt>Workspace</dt><dd>{workspaceName || 'Untitled'}</dd></div>
          </dl>
          {selectedTemplate && (
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-xs font-mono uppercase tracking-[0.2em] text-accent-primary">Workflow Template</p>
              <div className="mt-3 space-y-2 text-sm text-text-secondary">
                <div className="flex justify-between"><dt>Template</dt><dd className="text-text-primary font-medium">{selectedTemplate.name}</dd></div>
                <div className="flex justify-between"><dt>Execution Mode</dt><dd className="text-accent-secondary font-mono text-xs">{selectedTemplate.executionMode}</dd></div>
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
